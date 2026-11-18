import db from '../../../models/index.js';
import { getLandListWhere } from '../../../services/landAuthorizationService.js';
import {
  parseLandId,
  validateLandInput,
} from '../../../services/landValidationService.js';

const { AuditLog, Farm, Region, sequelize } = db;

const wantsJson = (req) =>
  req.xhr || req.headers?.accept?.includes('application/json');

const sendInputError = (req, res, fieldErrors) => {
  const errors = Object.values(fieldErrors).flat();
  if (wantsJson(req)) {
    return res.status(400).json({ success: false, errors, fieldErrors });
  }
  return res.status(400).send(errors.join(' '));
};

const getAuditSnapshot = (farm) => ({
  name: farm.name,
  size_hectares: farm.size_hectares,
  farming_type: farm.farming_type,
  municipality: farm.municipality,
  region_id: farm.region_id,
  location_lat: farm.location_lat,
  location_lng: farm.location_lng,
  user_id: farm.user_id,
  status: farm.status,
});

const findAccessibleFarm = (id, user, transaction) =>
  Farm.findOne({
    where: { ...getLandListWhere(user, { status: 'all' }), id },
    transaction,
  });

const sendMutationSuccess = (req, res, redirectTo) => {
  if (wantsJson(req)) return res.json({ success: true });
  return res.redirect(redirectTo);
};

export const updateFarmPrivate = async (req, res) => {
  const id = parseLandId(req.params.id);
  if (!id) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateLandInput(req.body);
  if (!validation.isValid) {
    return sendInputError(req, res, validation.fieldErrors);
  }

  try {
    if (
      validation.value.region_id &&
      !(await Region.findByPk(validation.value.region_id, {
        attributes: ['id'],
      }))
    ) {
      return sendInputError(req, res, {
        region_id: ['La región seleccionada no existe.'],
      });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findAccessibleFarm(id, req.user, transaction);
      if (!farm) return 'not_found';
      if (!farm.status) return 'invalid_status';

      const oldValues = getAuditSnapshot(farm);
      await farm.update(validation.value, { transaction });
      await AuditLog.create(
        {
          action: 'update',
          table_name: 'Farms',
          record_id: farm.id,
          old_values: oldValues,
          new_values: validation.value,
          user_id: req.user.id,
        },
        { transaction },
      );
      return 'updated';
    });

    if (result === 'not_found') {
      return res.status(404).send('Predio no encontrado');
    }
    if (result === 'invalid_status') {
      return res.status(409).send('Restaura el terreno antes de editarlo');
    }
    return sendMutationSuccess(req, res, `/private/lands/${id}/expediente`);
  } catch (error) {
    console.error('Error al actualizar el terreno:', error);
    return res.status(500).send('Error al actualizar el terreno');
  }
};

const changeFarmStatus = async (req, res, { action, expected, next }) => {
  const id = parseLandId(req.params.id);
  if (!id) return res.status(400).send('Identificador de terreno inválido');

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findAccessibleFarm(id, req.user, transaction);
      if (!farm) return 'not_found';
      if (farm.status !== expected) return 'invalid_status';

      await farm.update({ status: next }, { transaction });
      await AuditLog.create(
        {
          action,
          table_name: 'Farms',
          record_id: farm.id,
          old_values: { status: expected },
          new_values: { status: next },
          user_id: req.user.id,
        },
        { transaction },
      );
      return 'updated';
    });

    if (result === 'not_found') {
      return res.status(404).send('Predio no encontrado');
    }
    if (result === 'invalid_status') {
      return res.status(409).send('El terreno ya se encuentra en ese estado');
    }
    const redirectTo = next
      ? '/private/lands?status=active'
      : '/private/lands?status=archived';
    return sendMutationSuccess(req, res, redirectTo);
  } catch (error) {
    console.error(`Error al ${action} el terreno:`, error);
    return res.status(500).send('Error al cambiar el estado del terreno');
  }
};

export const archiveFarmPrivate = (req, res) =>
  changeFarmStatus(req, res, {
    action: 'archive',
    expected: true,
    next: false,
  });

export const restoreFarmPrivate = (req, res) =>
  changeFarmStatus(req, res, {
    action: 'restore',
    expected: false,
    next: true,
  });

const deleteFarmChildren = async (farmId, transaction) => {
  if (db.FarmApplication) {
    await db.FarmApplication.destroy({
      where: { farm_id: farmId },
      transaction,
    });
  }
  if (db.FarmHealthReport) {
    await db.FarmHealthReport.destroy({
      where: { farm_id: farmId },
      transaction,
    });
  }
  if (db.FarmLot) {
    await db.FarmLot.destroy({ where: { farm_id: farmId }, transaction });
  }
  if (db.FarmCrop) {
    if (db.FarmCropStage) {
      const crops = await db.FarmCrop.findAll({
        where: { farm_id: farmId },
        attributes: ['id'],
        transaction,
      });
      const cropIds = crops.map((c) => c.id);
      if (cropIds.length > 0) {
        await db.FarmCropStage.destroy({
          where: { farm_crop_id: cropIds },
          transaction,
        });
      }
    }
    await db.FarmCrop.destroy({ where: { farm_id: farmId }, transaction });
  }
};

export const deleteFarmPrivate = async (req, res) => {
  const id = parseLandId(req.params.id);
  if (!id) return res.status(400).send('Identificador de terreno inválido');

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findAccessibleFarm(id, req.user, transaction);
      if (!farm) return 'not_found';
      if (farm.status === true) return 'invalid_status';

      const oldValues = getAuditSnapshot(farm);
      await deleteFarmChildren(farm.id, transaction);
      await farm.destroy({ transaction });
      await AuditLog.create(
        {
          action: 'delete',
          table_name: 'Farms',
          record_id: farm.id,
          old_values: oldValues,
          new_values: null,
          user_id: req.user.id,
        },
        { transaction },
      );
      return 'deleted';
    });

    if (result === 'not_found') {
      return res.status(404).send('Predio no encontrado');
    }
    if (result === 'invalid_status') {
      return res
        .status(409)
        .send(
          'El predio debe estar archivado antes de poder eliminarse definitivamente.',
        );
    }
    return sendMutationSuccess(req, res, '/private/lands?status=archived');
  } catch (error) {
    console.error('Error al eliminar definitivamente el terreno:', error);
    return res.status(500).send('Error al eliminar el terreno');
  }
};
