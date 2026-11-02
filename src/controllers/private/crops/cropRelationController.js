import db from '../../../models/index.js';
import { getContextualCropPermissions } from '../../../services/cropAuthorizationService.js';
import { validateCropRelationsInput } from '../../../services/cropRelationService.js';
import { isCropEditable } from '../../../services/cropWorkflowService.js';
import { findMissingCatalogIds, getRecordId } from './cropControllerUtils.js';

const { AuditLog, Crop, Plague, Product } = db;

const parseCropRelationId = (id) => {
  if (!/^\d+$/.test(id)) return null;
  const num = Number(id);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
};

const verifyCropRelationPermissions = (crop, user) => {
  const recordPermissions = getContextualCropPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: crop.created_by_user_id,
  });
  if (!recordPermissions.canManageRelations) {
    return {
      status: 403,
      message:
        'Sólo el autor o un administrador puede modificar estas relaciones.',
    };
  }
  if (!isCropEditable(crop.workflow_status)) {
    return {
      status: 409,
      message:
        'Las relaciones solo pueden editarse en borrador o cambios solicitados.',
    };
  }
  return null;
};

const verifyCatalogRelations = async (plagueIds, productIds, transaction) => {
  const missingPlagues = await findMissingCatalogIds(
    Plague,
    plagueIds,
    transaction,
  );
  if (missingPlagues.length > 0) {
    return `No existen las plagas seleccionadas: ${missingPlagues.join(', ')}.`;
  }

  const missingProducts = await findMissingCatalogIds(
    Product,
    productIds,
    transaction,
  );
  if (missingProducts.length > 0) {
    return `No existen los productos seleccionados: ${missingProducts.join(', ')}.`;
  }

  return null;
};

const persistCropRelations = async ({
  crop,
  plagueIds,
  productIds,
  userId,
  transaction,
}) => {
  const currentPlagues = await crop.getPlagues({
    attributes: ['id'],
    joinTableAttributes: [],
    transaction,
  });
  const currentProducts = await crop.getProducts({
    attributes: ['id'],
    joinTableAttributes: [],
    transaction,
  });

  const oldValues = {
    plagues: currentPlagues.map(getRecordId),
    products: currentProducts.map(getRecordId),
  };
  const newValues = { plagues: plagueIds, products: productIds };

  await crop.setPlagues(plagueIds, { transaction });
  await crop.setProducts(productIds, { transaction });
  await crop.update({ updated_by_user_id: userId }, { transaction });

  await AuditLog.create(
    {
      action: 'crop.relations.update',
      table_name: 'CropRelations',
      record_id: crop.id,
      old_values: oldValues,
      new_values: newValues,
      user_id: userId,
    },
    { transaction },
  );
};

export const updateCropRelations = async (req, res) => {
  const cropId = parseCropRelationId(req.params.id);
  if (!cropId) return res.status(400).send('ID de cultivo no válido');

  const validation = validateCropRelationsInput(req.body);
  if (!validation.isValid) {
    return res.status(400).send(validation.errors.join(' '));
  }

  const { plagueIds, productIds } = validation.value;
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

    const permissionError = verifyCropRelationPermissions(crop, req.user);
    if (permissionError) {
      await transaction.rollback();
      return res.status(permissionError.status).send(permissionError.message);
    }

    const catalogError = await verifyCatalogRelations(
      plagueIds,
      productIds,
      transaction,
    );
    if (catalogError) {
      await transaction.rollback();
      return res.status(400).send(catalogError);
    }

    await persistCropRelations({
      crop,
      plagueIds,
      productIds,
      userId: req.user.id,
      transaction,
    });

    await transaction.commit();

    const wantsJson =
      req.xhr || req.headers.accept?.includes('application/json');
    if (wantsJson) {
      return res.json({
        success: true,
        message: 'Relaciones técnicas actualizadas exitosamente.',
      });
    }

    return res.redirect(`/private/crops/${cropId}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar las relaciones del cultivo:', error);
    return res
      .status(500)
      .send('Error al actualizar las relaciones del cultivo');
  }
};
