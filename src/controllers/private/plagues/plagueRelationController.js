import db from '../../../models/index.js';
import { getContextualPlaguePermissions } from '../../../services/plagueAuthorizationService.js';
import { validatePlagueRelationsInput } from '../../../services/plagueRelationService.js';
import { isPlagueEditable } from '../../../services/plagueWorkflowService.js';
import { findMissingCatalogIds, getRecordId } from './plagueControllerUtils.js';

const { AuditLog, Crop, Plague, PlagueRegion, Product, Region } = db;

export const updatePlagueRelations = async (req, res) => {
  const { id } = req.params;
  if (
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  ) {
    return res.status(400).send('ID de plaga no válido');
  }

  const validation = validatePlagueRelationsInput(req.body);
  if (!validation.isValid) {
    return res.status(400).send(validation.errors.join(' '));
  }

  const plagueId = Number(id);
  const { productIds, cropIds, regions } = validation.value;
  const transaction = await db.sequelize.transaction();

  try {
    const plague = await Plague.findByPk(plagueId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!plague) {
      await transaction.rollback();
      return res.status(404).send('Plaga no encontrada');
    }

    const recordPermissions = getContextualPlaguePermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: plague.created_by_user_id,
    });
    if (!recordPermissions.canManageRelations) {
      await transaction.rollback();
      return res
        .status(403)
        .send(
          'Sólo el autor o un administrador puede modificar estas relaciones.',
        );
    }
    if (!isPlagueEditable(plague.workflow_status)) {
      await transaction.rollback();
      return res
        .status(409)
        .send(
          'Las relaciones solo pueden editarse en borrador o correcciones.',
        );
    }

    const missingProducts = await findMissingCatalogIds(
      Product,
      productIds,
      transaction,
    );
    if (missingProducts.length > 0) {
      await transaction.rollback();
      return res
        .status(400)
        .send(
          `No existen los productos seleccionados: ${missingProducts.join(', ')}.`,
        );
    }

    const missingCrops = await findMissingCatalogIds(
      Crop,
      cropIds,
      transaction,
    );
    if (missingCrops.length > 0) {
      await transaction.rollback();
      return res
        .status(400)
        .send(
          `No existen los cultivos seleccionados: ${missingCrops.join(', ')}.`,
        );
    }

    const regionIds = regions.map((region) => region.region_id);
    const missingRegions = await findMissingCatalogIds(
      Region,
      regionIds,
      transaction,
    );
    if (missingRegions.length > 0) {
      await transaction.rollback();
      return res
        .status(400)
        .send(
          `No existen las regiones seleccionadas: ${missingRegions.join(', ')}.`,
        );
    }

    const currentProducts = await plague.getProducts({
      attributes: ['id'],
      joinTableAttributes: [],
      transaction,
    });
    const currentCrops = await plague.getCrops({
      attributes: ['id'],
      joinTableAttributes: [],
      transaction,
    });
    const currentRegions = await PlagueRegion.findAll({
      where: { plague_id: plagueId },
      attributes: ['region_id', 'risk_level'],
      order: [['region_id', 'ASC']],
      raw: true,
      transaction,
    });
    const oldValues = {
      products: currentProducts.map(getRecordId),
      crops: currentCrops.map(getRecordId),
      regions: currentRegions.map((region) => ({
        region_id: Number(region.region_id),
        risk_level: region.risk_level,
      })),
    };
    const newValues = { products: productIds, crops: cropIds, regions };

    await plague.setProducts(productIds, { transaction });
    await plague.setCrops(cropIds, { transaction });
    await PlagueRegion.destroy({
      where: { plague_id: plagueId },
      transaction,
    });
    if (regions.length > 0) {
      await PlagueRegion.bulkCreate(
        regions.map((region) => ({ plague_id: plagueId, ...region })),
        { transaction },
      );
    }

    await plague.update({ updated_by_user_id: req.user.id }, { transaction });
    await AuditLog.create(
      {
        action: 'plague.relations.update',
        table_name: 'PlagueRelations',
        record_id: plagueId,
        old_values: oldValues,
        new_values: newValues,
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return res.redirect(`/private/plagues/${plagueId}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar las relaciones de la plaga:', error);
    return res
      .status(500)
      .send('Error al actualizar las relaciones de la plaga');
  }
};
