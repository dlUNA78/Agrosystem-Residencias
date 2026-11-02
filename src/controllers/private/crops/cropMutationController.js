import db from '../../../models/index.js';
import { getContextualCropPermissions } from '../../../services/cropAuthorizationService.js';
import {
  buildCropImageRecords,
  buildCropImageUpdatePlan,
  cleanupStoredCropImages,
  cleanupUploadedCropFiles,
  MAX_CROP_IMAGES,
  parsePrimaryCropImageId,
  parseRemovedCropImageIds,
} from '../../../services/cropImageService.js';
import { validateCropInput } from '../../../services/cropValidationService.js';
import {
  CROP_WORKFLOW_STATUSES,
  isCropEditable,
} from '../../../services/cropWorkflowService.js';

const { Crop, CropImage, AuditLog } = db;

const parseCropId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

const rollbackWithUploads = async (transaction, files) => {
  await transaction.rollback();
  await cleanupUploadedCropFiles(files);
};

const wantsJsonResponse = (req) =>
  String(req.get?.('accept') || req.headers?.accept || '').includes(
    'application/json',
  );

const respondMutationError = (req, res, status, message, validation = {}) => {
  if (wantsJsonResponse(req)) {
    return res.status(status).json({
      success: false,
      message,
      errors: validation.errors || [message],
      fieldErrors: validation.fieldErrors || {},
    });
  }

  return res.status(status).send(message);
};

const respondMutationSuccess = (
  req,
  res,
  message,
  redirect = '/private/crops',
) => {
  if (wantsJsonResponse(req)) {
    return res.json({
      success: true,
      message,
      redirect,
    });
  }

  return res.redirect(redirect);
};

const checkCropEditEligibility = (crop, user) => {
  const permissions = getContextualCropPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: crop.created_by_user_id,
  });

  if (!permissions.canEdit) {
    return {
      status: 403,
      message: 'Sólo el autor o un administrador puede editar este cultivo.',
    };
  }

  if (!isCropEditable(crop.workflow_status)) {
    return {
      status: 409,
      message: 'El cultivo debe estar en borrador para poder editarse.',
    };
  }

  return null;
};

const prepareCropUpdateContext = async ({
  cropId,
  body,
  files,
  user,
  transaction,
}) => {
  const crop = await Crop.findByPk(cropId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!crop) {
    return { errorStatus: 404, errorMessage: 'Cultivo no encontrado.' };
  }

  const eligibility = checkCropEditEligibility(crop, user);
  if (eligibility) {
    return {
      errorStatus: eligibility.status,
      errorMessage: eligibility.message,
    };
  }

  const existingImages = await CropImage.findAll({
    where: { crop_id: crop.id },
    transaction,
    order: [['display_order', 'ASC']],
  });

  const removedImageIds = parseRemovedCropImageIds(body?.removed_image_ids);
  const primaryImageId = parsePrimaryCropImageId(body?.primary_image_id);
  const imagePlan = buildCropImageUpdatePlan({
    existingImages,
    removedImageIds,
    newFileCount: files.length,
    primaryImageId,
  });
  if (imagePlan.error) {
    return { errorStatus: 400, errorMessage: imagePlan.error };
  }

  return { crop, imagePlan };
};

const applyCropImageUpdates = async ({
  cropId,
  files,
  imageUpdatePlan,
  transaction,
}) => {
  const { removedImages, nextPrimaryId, nextImageOrder, hasRemainingPrimary } =
    imageUpdatePlan;

  if (removedImages.length > 0) {
    const removedIds = removedImages.map((img) => img.id);
    await CropImage.destroy({
      where: { id: removedIds, crop_id: cropId },
      transaction,
    });
  }

  if (nextPrimaryId) {
    await CropImage.update(
      { is_primary: false },
      { where: { crop_id: cropId }, transaction },
    );
    await CropImage.update(
      { is_primary: true },
      { where: { id: nextPrimaryId, crop_id: cropId }, transaction },
    );
  }

  if (files.length > 0) {
    await CropImage.bulkCreate(
      buildCropImageRecords({
        cropId,
        files,
        startOrder: nextImageOrder,
        hasPrimary: hasRemainingPrimary,
      }),
      { transaction },
    );
  }
};

export const createCrop = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length > MAX_CROP_IMAGES) {
    await cleanupUploadedCropFiles(files);
    return respondMutationError(
      req,
      res,
      400,
      'La galería puede contener como máximo 10 imágenes.',
    );
  }

  const validation = validateCropInput(req.body);
  if (!validation.isValid) {
    await cleanupUploadedCropFiles(files);
    return respondMutationError(
      req,
      res,
      400,
      'Revisa los datos marcados antes de guardar el cultivo.',
      validation,
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
    const crop = await Crop.create(
      {
        ...validation.value,
        workflow_status: CROP_WORKFLOW_STATUSES.DRAFT,
        created_by_user_id: req.user.id,
        updated_by_user_id: req.user.id,
        status: 'pendiente',
      },
      { transaction },
    );

    if (files.length > 0) {
      await CropImage.bulkCreate(
        buildCropImageRecords({ cropId: crop.id, files }),
        { transaction },
      );
    }

    await AuditLog.create(
      {
        action: 'crop.create',
        table_name: 'Crops',
        record_id: crop.id,
        old_values: null,
        new_values: crop.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return respondMutationSuccess(req, res, 'Cultivo creado correctamente.');
  } catch (error) {
    await rollbackWithUploads(transaction, files);
    console.error('Error al crear el cultivo:', error);
    return respondMutationError(
      req,
      res,
      500,
      'No se pudo crear el cultivo. Intenta nuevamente.',
    );
  }
};

export const updateCrop = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const cropId = parseCropId(req.params.id);
  if (!cropId) {
    await cleanupUploadedCropFiles(files);
    return respondMutationError(req, res, 400, 'ID de cultivo no válido.');
  }

  if (parseRemovedCropImageIds(req.body?.removed_image_ids) === null) {
    await cleanupUploadedCropFiles(files);
    return respondMutationError(
      req,
      res,
      400,
      'La selección de imágenes que deseas quitar no es válida.',
    );
  }

  const validation = validateCropInput(req.body);
  if (!validation.isValid) {
    await cleanupUploadedCropFiles(files);
    return respondMutationError(
      req,
      res,
      400,
      'Revisa los datos marcados antes de guardar el cultivo.',
      validation,
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
    const planResult = await prepareCropUpdateContext({
      cropId,
      body: req.body,
      files,
      user: req.user,
      transaction,
    });

    if (planResult.errorStatus) {
      await rollbackWithUploads(transaction, files);
      return respondMutationError(
        req,
        res,
        planResult.errorStatus,
        planResult.errorMessage,
      );
    }

    const { crop, imagePlan } = planResult;
    const oldValues = crop.toJSON();

    await crop.update(
      { ...validation.value, updated_by_user_id: req.user.id },
      { transaction },
    );

    await applyCropImageUpdates({
      cropId: crop.id,
      files,
      imageUpdatePlan: imagePlan,
      transaction,
    });

    await AuditLog.create(
      {
        action: 'crop.update',
        table_name: 'Crops',
        record_id: crop.id,
        old_values: oldValues,
        new_values: crop.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    await cleanupStoredCropImages(imagePlan.removedImages);

    const redirectUrl = req.body?._redirect_dossier
      ? `/private/crops/${crop.id}`
      : '/private/crops';
    return respondMutationSuccess(
      req,
      res,
      'Cultivo actualizado correctamente.',
      redirectUrl,
    );
  } catch (error) {
    await rollbackWithUploads(transaction, files);
    console.error('Error al actualizar el cultivo:', error);
    return respondMutationError(
      req,
      res,
      500,
      'No se pudo actualizar el cultivo. Intenta nuevamente.',
    );
  }
};

export const deleteCrop = async (req, res) => {
  const cropId = parseCropId(req.params.id);
  if (!cropId) {
    return respondMutationError(req, res, 400, 'ID de cultivo no válido.');
  }

  const transaction = await db.sequelize.transaction();
  try {
    const crop = await Crop.findByPk(cropId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!crop) {
      await transaction.rollback();
      return respondMutationError(req, res, 404, 'Cultivo no encontrado.');
    }

    const images = await CropImage.findAll({
      where: { crop_id: crop.id },
      attributes: ['image_url'],
      transaction,
    });
    const oldValues = crop.toJSON();

    await CropImage.destroy({ where: { crop_id: crop.id }, transaction });
    await crop.destroy({ transaction });
    await AuditLog.create(
      {
        action: 'crop.delete',
        table_name: 'Crops',
        record_id: crop.id,
        old_values: oldValues,
        new_values: null,
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    try {
      await cleanupStoredCropImages(
        images.map((image) => image.toJSON?.() || image),
      );
    } catch (cleanupError) {
      console.error(
        'El cultivo se eliminó, pero quedaron imágenes huérfanas:',
        cleanupError,
      );
    }

    return respondMutationSuccess(
      req,
      res,
      'Cultivo eliminado correctamente.',
      '/private/crops',
    );
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar el cultivo:', error);
    return respondMutationError(
      req,
      res,
      500,
      'Error al eliminar el cultivo. Intenta nuevamente.',
    );
  }
};
