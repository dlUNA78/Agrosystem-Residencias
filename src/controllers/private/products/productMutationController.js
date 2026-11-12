import db from '../../../models/index.js';
import { getContextualProductPermissions } from '../../../services/productAuthorizationService.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';
import {
  MAX_PRODUCT_IMAGES,
  buildExistingProductImageSourceUpdates,
  buildProductImageRecords,
  buildProductImageUpdatePlan,
  cleanupStoredProductImages,
  cleanupUploadedProductFiles,
  parsePrimaryProductImageId,
  parseRemovedProductImageIds,
} from '../../../services/productImageService.js';
import { validateProductRelationsInput } from '../../../services/productRelationService.js';
import { validateProductInput } from '../../../services/productValidationService.js';
import {
  PRODUCT_WORKFLOW_STATUSES,
  isProductEditable,
} from '../../../services/productWorkflowService.js';
import { getProductDeactivationImpact } from '../../../services/deactivationImpactService.js';
import { parsePositiveId } from './productControllerUtils.js';

const { AuditLog, Crop, Plague, Product, ProductImage } = db;

const wantsJson = (req) =>
  String(req.get?.('accept') || req.headers?.accept || '').includes(
    'application/json',
  );

const failure = (req, res, status, message, validation = {}) => {
  if (wantsJson(req)) {
    return res.status(status).json({
      success: false,
      message,
      errors: validation.errors || [message],
      fieldErrors: validation.fieldErrors || {},
    });
  }
  return res.status(status).send(message);
};

const success = (req, res, message, redirect = '/private/products') => {
  if (wantsJson(req)) return res.json({ success: true, message, redirect });
  return res.redirect(redirect);
};

const rollbackWithFiles = async (transaction, files) => {
  await transaction.rollback();
  await cleanupUploadedProductFiles(files);
};

const isControlledProductStage = (status) =>
  status === PRODUCT_WORKFLOW_STATUSES.VERIFIED ||
  status === PRODUCT_WORKFLOW_STATUSES.PUBLISHED;

const isControlledEditAuthorized = (product, user, body) =>
  body?.controlled_edit === '1' &&
  (user.role === 'admin' || user.role === 'inifap') &&
  isControlledProductStage(product.workflow_status);

const getUpdateRestriction = (product, user, body) => {
  const isControlled = body?.controlled_edit === '1';
  const editReason = String(body?.edit_reason || '').trim();
  if (isControlled && editReason.length < 10) {
    return {
      status: 400,
      message:
        'Debes capturar una justificación técnica de al menos 10 caracteres para modificar el registro.',
    };
  }
  if (isControlledEditAuthorized(product, user, body)) {
    return null;
  }
  const permissions = getContextualProductPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: product.created_by_user_id,
  });
  if (!permissions.canEdit) {
    return {
      status: 403,
      message: 'Sólo el autor o un administrador puede editar este producto.',
    };
  }
  if (!isProductEditable(product.workflow_status)) {
    return {
      status: 409,
      message: 'El producto no está en una etapa editable.',
    };
  }
  return null;
};

const buildProductUpdatePayload = (product, parsedValue, user, body) => {
  const isControlled = body?.controlled_edit === '1';
  if (!isControlled) {
    return { ...parsedValue, updated_by_user_id: user.id };
  }
  const editReason = String(body?.edit_reason || '').trim();
  const actorLabel = user.full_name || user.email || 'Especialista INIFAP';
  const lockedIdentity = {
    name: product.name,
    registration_code: product.registration_code,
    active_ingredient: product.active_ingredient,
    category: product.category,
  };
  const stageTransition = isControlledProductStage(product.workflow_status)
    ? {
        workflow_status: PRODUCT_WORKFLOW_STATUSES.IN_REVIEW,
        validation_status: 'En revisión',
        status: false,
        verified_by_user_id: null,
        verified_at: null,
        created_by_user_id: product.created_by_user_id || user.id,
      }
    : {};
  return {
    ...parsedValue,
    ...lockedIdentity,
    ...stageTransition,
    review_notes: `[Edición controlada · ${actorLabel}]: ${editReason}`,
    updated_by_user_id: user.id,
  };
};

const requireProduct = (product) => {
  if (product) return product;
  const error = new Error('Producto no encontrado.');
  error.status = 404;
  error.safeMessage = error.message;
  throw error;
};

const getSafeErrorResponse = (error) => ({
  status: error.status || 500,
  message: error.safeMessage || 'No se pudo actualizar el producto.',
});

const validateRelationsExist = async ({ cropIds, plagueIds }, transaction) => {
  const [cropCount, plagueCount] = await Promise.all([
    cropIds.length
      ? Crop.count({
          where: {
            id: cropIds,
            status: 'aprobado',
            workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
          },
          transaction,
        })
      : 0,
    plagueIds.length
      ? Plague.count({
          where: {
            id: plagueIds,
            status: true,
            workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
          },
          transaction,
        })
      : 0,
  ]);
  return cropCount === cropIds.length && plagueCount === plagueIds.length;
};

const parseMutationInputs = (req, files) => {
  if (files.length > MAX_PRODUCT_IMAGES) {
    return {
      errorMessage: 'La galería puede contener como máximo 10 imágenes.',
    };
  }
  const removedImageIds = parseRemovedProductImageIds(
    req.body?.removed_image_ids,
  );
  if (removedImageIds === null) {
    return {
      errorMessage: 'La selección de imágenes que deseas quitar no es válida.',
    };
  }
  const validation = validateProductInput(req.body);
  const relations = validateProductRelationsInput(req.body);
  if (!validation.isValid || !relations.isValid) {
    return {
      errorMessage: 'Revisa los datos marcados antes de guardar el producto.',
      validation: !relations.isValid
        ? {
            errors: relations.errors,
            fieldErrors: { relations: relations.errors },
          }
        : validation,
    };
  }
  return {
    value: validation.value,
    relations: relations.value,
    removedImageIds,
    primaryImageId: parsePrimaryProductImageId(req.body?.primary_image_id),
  };
};

const updateExistingProductImageSources = async ({
  productId,
  remainingImages = [],
  body,
  transaction,
}) => {
  const sourceUpdates = buildExistingProductImageSourceUpdates({
    existingImages: remainingImages,
    removedImageIds: [],
    rawIds: body?.existing_image_source_ids,
    rawSources: body?.existing_image_sources,
    defaultSource: body?.image_source_default,
  });
  if (!sourceUpdates.length || typeof ProductImage?.update !== 'function') {
    return;
  }
  await Promise.all(
    sourceUpdates.map((item) =>
      ProductImage.update(
        { source: item.source },
        { where: { id: item.id, product_id: productId }, transaction },
      ),
    ),
  );
};

const applyImageUpdates = async ({
  product,
  files,
  removedImageIds,
  primaryImageId,
  body,
  transaction,
}) => {
  const existingRows = await ProductImage.findAll({
    where: { product_id: product.id },
    order: [
      ['is_primary', 'DESC'],
      ['display_order', 'ASC'],
    ],
    transaction,
  });
  const plan = buildProductImageUpdatePlan({
    existingImages: existingRows.map((row) => row.toJSON()),
    removedImageIds,
    newFileCount: files.length,
    primaryImageId,
  });
  if (plan.error) return { error: plan.error };

  if (removedImageIds.length > 0) {
    await ProductImage.destroy({
      where: { id: removedImageIds, product_id: product.id },
      transaction,
    });
  }
  if (plan.remainingImages.length > 0) {
    await ProductImage.update(
      { is_primary: false },
      { where: { product_id: product.id }, transaction },
    );
    if (plan.nextPrimaryId) {
      await ProductImage.update(
        { is_primary: true },
        {
          where: { id: plan.nextPrimaryId, product_id: product.id },
          transaction,
        },
      );
    }
  }
  await updateExistingProductImageSources({
    productId: product.id,
    remainingImages: plan.remainingImages,
    body,
    transaction,
  });
  if (files.length > 0) {
    await ProductImage.bulkCreate(
      buildProductImageRecords({
        productId: product.id,
        files,
        startOrder: plan.nextImageOrder,
        hasPrimary: plan.hasPrimary,
        sources: body?.new_image_sources,
        defaultSource: body?.image_source_default,
      }),
      { transaction },
    );
  }
  return { removedImages: plan.removedImages };
};

export const createProduct = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const parsed = parseMutationInputs(req, files);
  if (parsed.errorMessage) {
    await cleanupUploadedProductFiles(files);
    return failure(req, res, 400, parsed.errorMessage, parsed.validation);
  }

  const transaction = await db.sequelize.transaction();
  try {
    if (!(await validateRelationsExist(parsed.relations, transaction))) {
      await rollbackWithFiles(transaction, files);
      return failure(
        req,
        res,
        400,
        'Alguna plaga o cultivo seleccionado ya no existe.',
      );
    }
    const product = await Product.create(
      {
        ...parsed.value,
        workflow_status: PRODUCT_WORKFLOW_STATUSES.DRAFT,
        validation_status: 'En revisión',
        status: false,
        created_by_user_id: req.user.id,
        updated_by_user_id: req.user.id,
      },
      { transaction },
    );
    if (files.length > 0) {
      await ProductImage.bulkCreate(
        buildProductImageRecords({
          productId: product.id,
          files,
          sources: req.body?.new_image_sources,
          defaultSource: req.body?.image_source_default,
        }),
        { transaction },
      );
    }
    await product.setCrops(parsed.relations.cropIds, { transaction });
    await product.setPlagues(parsed.relations.plagueIds, { transaction });
    await AuditLog.create(
      {
        action: 'product.create',
        table_name: 'Products',
        record_id: product.id,
        old_values: null,
        new_values: product.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );
    await transaction.commit();
    return success(req, res, 'Producto creado correctamente.');
  } catch (error) {
    await rollbackWithFiles(transaction, files);
    console.error('Error al crear producto:', error);
    return failure(req, res, 500, 'No se pudo crear el producto.');
  }
};

export const updateProduct = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const productId = parsePositiveId(req.params.id);
  if (!productId) {
    await cleanupUploadedProductFiles(files);
    return failure(req, res, 400, 'ID de producto no válido.');
  }
  const parsed = parseMutationInputs(req, files);
  if (parsed.errorMessage) {
    await cleanupUploadedProductFiles(files);
    return failure(req, res, 400, parsed.errorMessage, parsed.validation);
  }

  const transaction = await db.sequelize.transaction();
  try {
    const product = requireProduct(
      await Product.findByPk(productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
    );
    const restriction = getUpdateRestriction(product, req.user, req.body);
    if (restriction) {
      await rollbackWithFiles(transaction, files);
      return failure(req, res, restriction.status, restriction.message);
    }
    if (!(await validateRelationsExist(parsed.relations, transaction))) {
      await rollbackWithFiles(transaction, files);
      return failure(
        req,
        res,
        400,
        'Alguna plaga o cultivo seleccionado ya no existe.',
      );
    }

    const oldValues = product.toJSON();
    await product.update(
      buildProductUpdatePayload(product, parsed.value, req.user, req.body),
      { transaction },
    );
    const imageUpdate = await applyImageUpdates({
      product,
      files,
      removedImageIds: parsed.removedImageIds,
      primaryImageId: parsed.primaryImageId,
      body: req.body,
      transaction,
    });
    if (imageUpdate.error) {
      await rollbackWithFiles(transaction, files);
      return failure(req, res, 400, imageUpdate.error);
    }

    await product.setCrops(parsed.relations.cropIds, { transaction });
    await product.setPlagues(parsed.relations.plagueIds, { transaction });
    await AuditLog.create(
      {
        action: 'product.update',
        table_name: 'Products',
        record_id: product.id,
        old_values: oldValues,
        new_values: product.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );
    await transaction.commit();
    await cleanupStoredProductImages(imageUpdate.removedImages);
    return success(
      req,
      res,
      'Producto actualizado correctamente.',
      `/private/products/${product.id}`,
    );
  } catch (error) {
    await rollbackWithFiles(transaction, files);
    console.error('Error al actualizar producto:', error);
    const safeError = getSafeErrorResponse(error);
    return failure(req, res, safeError.status, safeError.message);
  }
};

export const deleteProduct = async (req, res) => {
  const productId = parsePositiveId(req.params.id);
  if (!productId) return failure(req, res, 400, 'ID de producto no válido.');
  const transaction = await db.sequelize.transaction();

  try {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      await transaction.rollback();
      return failure(req, res, 404, 'Producto no encontrado.');
    }

    if (
      product.workflow_status === PRODUCT_WORKFLOW_STATUSES.PUBLISHED ||
      product.workflow_status === PRODUCT_WORKFLOW_STATUSES.VERIFIED ||
      product.workflow_status === PRODUCT_WORKFLOW_STATUSES.ARCHIVE_PENDING
    ) {
      await transaction.rollback();
      return failure(
        req,
        res,
        409,
        'Los productos publicados o en verificación no pueden eliminarse directamente. Debes tramitar la baja justificada a través del flujo editorial con aprobación dual.',
      );
    }

    const impact = await getProductDeactivationImpact(product.id, transaction);
    if (impact.hasBlockingDependencies) {
      await transaction.rollback();
      return failure(req, res, 409, impact.message);
    }

    const oldValues = product.toJSON();
    const images = await ProductImage.findAll({
      where: { product_id: product.id },
      attributes: ['image_url'],
      transaction,
    });
    await ProductImage.destroy({
      where: { product_id: product.id },
      transaction,
    });
    await product.destroy({ transaction });
    await AuditLog.create(
      {
        action: 'product.delete',
        table_name: 'Products',
        record_id: product.id,
        old_values: oldValues,
        new_values: null,
        user_id: req.user.id,
      },
      { transaction },
    );
    await transaction.commit();
    await cleanupStoredProductImages(
      images.map((image) => image.toJSON?.() || image),
    );
    return success(req, res, 'Producto eliminado correctamente.');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar producto:', error);
    return failure(req, res, 500, 'No se pudo eliminar el producto.');
  }
};
