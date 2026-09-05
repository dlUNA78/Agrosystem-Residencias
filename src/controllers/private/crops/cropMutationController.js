import db from '../../../models/index.js';
import { getContextualCropPermissions } from '../../../services/cropAuthorizationService.js';
import {
  buildCropImageRecords,
  cleanupStoredCropImages,
  cleanupUploadedCropFiles,
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

const respondMutationSuccess = (req, res, message) => {
  if (wantsJsonResponse(req)) {
    return res.json({
      success: true,
      message,
      redirect: '/private/crops',
    });
  }

  return res.redirect('/private/crops');
};

export const createCrop = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
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
    const crop = await Crop.findByPk(cropId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!crop) {
      await rollbackWithUploads(transaction, files);
      return respondMutationError(req, res, 404, 'Cultivo no encontrado.');
    }

    const permissions = getContextualCropPermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: crop.created_by_user_id,
    });

    if (!permissions.canEdit) {
      await rollbackWithUploads(transaction, files);
      return respondMutationError(
        req,
        res,
        403,
        'Sólo el autor o un administrador puede editar este cultivo.',
      );
    }

    if (!isCropEditable(crop.workflow_status)) {
      await rollbackWithUploads(transaction, files);
      return respondMutationError(
        req,
        res,
        409,
        'El cultivo debe estar en borrador para poder editarse.',
      );
    }

    const oldValues = crop.toJSON();
    await crop.update(
      { ...validation.value, updated_by_user_id: req.user.id },
      { transaction },
    );

    if (files.length > 0) {
      const existingImageCount = await CropImage.count({
        where: { crop_id: crop.id },
        transaction,
      });
      await CropImage.bulkCreate(
        buildCropImageRecords({
          cropId: crop.id,
          files,
          startOrder: existingImageCount,
          hasPrimary: existingImageCount > 0,
        }),
        { transaction },
      );
    }

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
    return respondMutationSuccess(
      req,
      res,
      'Cultivo actualizado correctamente.',
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
  if (!cropId) return res.status(400).send('ID de cultivo no válido');

  const transaction = await db.sequelize.transaction();

  try {
    const crop = await Crop.findByPk(cropId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!crop) {
      await transaction.rollback();
      return res.status(404).send('Cultivo no encontrado');
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
    return res.redirect('/private/crops');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar el cultivo:', error);
    return res.status(500).send('Error al eliminar el cultivo');
  }
};
