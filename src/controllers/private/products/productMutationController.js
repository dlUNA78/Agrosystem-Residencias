import db from '../../../models/index.js';
import { getContextualProductPermissions } from '../../../services/productAuthorizationService.js';
import {
  buildProductImageRecords,
  cleanupStoredProductImages,
  cleanupUploadedProductFiles,
} from '../../../services/productImageService.js';
import { validateProductInput } from '../../../services/productValidationService.js';
import {
  PRODUCT_WORKFLOW_STATUSES,
  isProductEditable,
} from '../../../services/productWorkflowService.js';

const { Product, ProductImage, AuditLog } = db;
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

export const createProduct = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const validation = validateProductInput(req.body);
  if (!validation.isValid) {
    await cleanupUploadedProductFiles(files);
    return failure(
      req,
      res,
      400,
      'Revisa los datos marcados antes de guardar el producto.',
      validation,
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
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
  if (!validation.isValid) {
    await cleanupUploadedProductFiles(files);
    return failure(
      req,
      res,
      400,
      'Revisa los datos marcados antes de guardar el producto.',
      validation,
    );
  }

  const transaction = await db.sequelize.transaction();
  try {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      await rollbackWithFiles(transaction, files);
      return failure(req, res, 404, 'Producto no encontrado.');
    }
    const permissions = getContextualProductPermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: product.created_by_user_id,
    });
    if (!permissions.canEdit) {
      await rollbackWithFiles(transaction, files);
      return failure(
        req,
        res,
        403,
        'Sólo el autor o un administrador puede editar este producto.',
      );
    }
    if (!isProductEditable(product.workflow_status)) {
      await rollbackWithFiles(transaction, files);
      return failure(
        req,
        res,
        409,
        'El producto no está en una etapa editable.',
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
    return failure(req, res, 500, 'No se pudo actualizar el producto.');
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
