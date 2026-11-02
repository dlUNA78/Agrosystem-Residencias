import db from '../../../models/index.js';
import { getContextualProductPermissions } from '../../../services/productAuthorizationService.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';
import { validateProductRelationsInput } from '../../../services/productRelationService.js';
import { isProductEditable } from '../../../services/productWorkflowService.js';
import { getRecordId, parsePositiveId } from './productControllerUtils.js';

const { AuditLog, Crop, Plague, Product } = db;

const verifyRelationPermissions = (product, user) => {
  const permissions = getContextualProductPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: product.created_by_user_id,
  });
  if (!permissions.canManageRelations) {
    return {
      status: 403,
      message:
        'Sólo el autor o un administrador puede modificar estas relaciones.',
    };
  }
  if (!isProductEditable(product.workflow_status)) {
    return {
      status: 409,
      message:
        'Las relaciones solo pueden editarse en borrador o cambios solicitados.',
    };
  }
  return null;
};

const verifyPublishedTargets = async ({ cropIds, plagueIds }, transaction) => {
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

  if (cropCount !== cropIds.length || plagueCount !== plagueIds.length) {
    return 'Alguna plaga o cultivo seleccionado no existe o no está publicado.';
  }
  return null;
};

const persistProductRelations = async ({
  product,
  cropIds,
  plagueIds,
  userId,
  transaction,
}) => {
  const [currentCrops, currentPlagues] = await Promise.all([
    product.getCrops({
      attributes: ['id'],
      joinTableAttributes: [],
      transaction,
    }),
    product.getPlagues({
      attributes: ['id'],
      joinTableAttributes: [],
      transaction,
    }),
  ]);

  const oldValues = {
    crops: currentCrops.map(getRecordId),
    plagues: currentPlagues.map(getRecordId),
  };
  const newValues = { crops: cropIds, plagues: plagueIds };

  await product.setCrops(cropIds, { transaction });
  await product.setPlagues(plagueIds, { transaction });
  await product.update({ updated_by_user_id: userId }, { transaction });
  await AuditLog.create(
    {
      action: 'product.relations.update',
      table_name: 'ProductRelations',
      record_id: product.id,
      old_values: oldValues,
      new_values: newValues,
      user_id: userId,
    },
    { transaction },
  );
};

export const updateProductRelations = async (req, res) => {
  const productId = parsePositiveId(req.params.id);
  if (!productId) return res.status(400).send('ID de producto no válido.');

  const validation = validateProductRelationsInput(req.body);
  if (!validation.isValid) {
    return res.status(400).send(validation.errors.join(' '));
  }

  const { cropIds, plagueIds } = validation.value;
  const transaction = await db.sequelize.transaction();

  try {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      await transaction.rollback();
      return res.status(404).send('Producto no encontrado.');
    }

    const restriction = verifyRelationPermissions(product, req.user);
    if (restriction) {
      await transaction.rollback();
      return res.status(restriction.status).send(restriction.message);
    }

    const catalogError = await verifyPublishedTargets(
      { cropIds, plagueIds },
      transaction,
    );
    if (catalogError) {
      await transaction.rollback();
      return res.status(400).send(catalogError);
    }

    await persistProductRelations({
      product,
      cropIds,
      plagueIds,
      userId: req.user.id,
      transaction,
    });

    await transaction.commit();
    return res.redirect(`/private/products/${product.id}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar relaciones del producto:', error);
    return res
      .status(500)
      .send('No se pudieron actualizar las relaciones del producto.');
  }
};
