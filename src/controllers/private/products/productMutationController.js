import db from '../../../models/index.js';
import { getContextualProductPermissions } from '../../../services/productAuthorizationService.js';
import {
  buildProductImageRecords,
  cleanupStoredProductImages,
  cleanupUploadedProductFiles,
} from '../../../services/productImageService.js';
import { validateProductInput } from '../../../services/productValidationService.js';
import { validateProductRelationsInput } from '../../../services/productRelationService.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';
import {
  PRODUCT_WORKFLOW_STATUSES,
  isProductEditable,
} from '../../../services/productWorkflowService.js';

const { Product, ProductImage, Plague, Crop, AuditLog } = db;
const parseId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};
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
const getUpdateRestriction = (product, user) => {
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
    Crop.count({
      where: {
        id: cropIds,
        status: 'aprobado',
        workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
      },
      transaction,
    }),
    Plague.count({
      where: {
        id: plagueIds,
        status: true,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
      },
      transaction,
    }),
  ]);
  return cropCount === cropIds.length && plagueCount === plagueIds.length;
};

const readRelations = (req) => {
  const relations = validateProductRelationsInput(req.body);
  if (!relations.isValid) {
    return {
      error: {
        isValid: false,
        errors: relations.errors,
        fieldErrors: { relations: relations.errors },
      },
    };
  }
  return { value: relations.value };
};

export const createProduct = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const validation = validateProductInput(req.body);
  const relations = readRelations(req);
  if (!validation.isValid || relations.error) {
    await cleanupUploadedProductFiles(files);
    return failure(
      req,
      res,
      400,
      'Revisa los datos marcados antes de guardar el producto.',
      relations.error || validation,
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
    if (!(await validateRelationsExist(relations.value, transaction))) {
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
        ...validation.value,
        workflow_status: PRODUCT_WORKFLOW_STATUSES.DRAFT,
        validation_status: 'En revisión',
        status: true,
        created_by_user_id: req.user.id,
        updated_by_user_id: req.user.id,
      },
      { transaction },
    );
    if (files.length) {
      await ProductImage.bulkCreate(
        buildProductImageRecords({ productId: product.id, files }),
        { transaction },
      );
    }
    await product.setCrops(relations.value.cropIds, { transaction });
    await product.setPlagues(relations.value.plagueIds, { transaction });
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
  const productId = parseId(req.params.id);
  if (!productId) {
    await cleanupUploadedProductFiles(files);
    return failure(req, res, 400, 'ID de producto no válido.');
  }
  const validation = validateProductInput(req.body);
  const relations = readRelations(req);
  if (!validation.isValid || relations.error) {
    await cleanupUploadedProductFiles(files);
    return failure(
      req,
      res,
      400,
      'Revisa los datos marcados antes de guardar el producto.',
      relations.error || validation,
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
    const product = requireProduct(
      await Product.findByPk(productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
    );
    const restriction = getUpdateRestriction(product, req.user);
    if (restriction) {
      await rollbackWithFiles(transaction, files);
      return failure(req, res, restriction.status, restriction.message);
    }
    if (!(await validateRelationsExist(relations.value, transaction))) {
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
      { ...validation.value, updated_by_user_id: req.user.id },
      { transaction },
    );
    if (files.length) {
      const existing = await ProductImage.count({
        where: { product_id: product.id },
        transaction,
      });
      await ProductImage.bulkCreate(
        buildProductImageRecords({
          productId: product.id,
          files,
          startOrder: existing,
          hasPrimary: existing > 0,
        }),
        { transaction },
      );
    }
    await product.setCrops(relations.value.cropIds, { transaction });
    await product.setPlagues(relations.value.plagueIds, { transaction });
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
  const productId = parseId(req.params.id);
  if (!productId) return failure(req, res, 400, 'ID de producto no válido.');
  const transaction = await db.sequelize.transaction();

  try {
    const product = await Product.findByPk(productId, { transaction });
    if (!product) {
      await transaction.rollback();
      return failure(req, res, 404, 'Producto no encontrado.');
    }
    const images = await ProductImage.findAll({
      where: { product_id: product.id },
      attributes: ['image_url'],
      transaction,
    });
    const oldValues = product.toJSON();
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
    try {
      await cleanupStoredProductImages(
        images.map((image) => image.toJSON?.() || image),
      );
    } catch (cleanupError) {
      console.error(
        'El producto se eliminó, pero quedaron imágenes huérfanas:',
        cleanupError,
      );
    }
    return success(req, res, 'Producto eliminado correctamente.');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar producto:', error);
    return failure(req, res, 500, 'No se pudo eliminar el producto.');
  }
};
