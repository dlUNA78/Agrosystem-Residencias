import { Op } from 'sequelize';

import db from '../../../models/index.js';
import { validateFarmLotInput } from '../../../services/landOperationalValidationService.js';
import { parseLandId } from '../../../services/landValidationService.js';
import {
  createLandAudit,
  findActiveLand,
  sendOperationSuccess,
  sendValidationError,
} from './landControllerUtils.js';

const { FarmCrop, FarmLot, sequelize } = db;

const handleLotOperationError = (res, result) => {
  if (result === 'farm_not_found') {
    return res.status(404).send('Predio no encontrado');
  }
  if (result === 'lot_not_found') {
    return res.status(404).send('Lote no encontrado');
  }
  if (result === 'lot_exists') {
    return res
      .status(409)
      .send('Ya existe un lote activo con este nombre en este terreno');
  }
  return null;
};

export const createLandLot = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  if (!farmId) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateFarmLotInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';

      const existing = await FarmLot.findOne({
        where: {
          farm_id: farm.id,
          name: validation.value.name,
          status: true,
        },
        transaction,
      });
      if (existing) return 'lot_exists';

      const lot = await FarmLot.create(
        {
          farm_id: farm.id,
          name: validation.value.name,
          size_hectares: validation.value.size_hectares || null,
          description: validation.value.description || null,
          status: true,
        },
        { transaction },
      );

      await createLandAudit(
        {
          action: 'create_farm_lot',
          recordId: farm.id,
          newValues: lot.toJSON ? lot.toJSON() : lot,
          userId: req.user.id,
        },
        transaction,
      );

      return { lot };
    });

    const errorResponse = handleLotOperationError(res, result);
    if (errorResponse) return errorResponse;

    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
      status: 201,
      payload: result,
    });
  } catch (error) {
    console.error('Error al registrar el lote del terreno:', error);
    return res.status(500).send('Error al registrar el lote del terreno');
  }
};

export const updateLandLot = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  const lotId = parseLandId(req.params.lotId);
  if (!farmId || !lotId) {
    return res.status(400).send('Identificador de terreno o lote inválido');
  }

  const validation = validateFarmLotInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';

      const lot = await FarmLot.findOne({
        where: {
          id: lotId,
          farm_id: farm.id,
          status: true,
        },
        transaction,
      });
      if (!lot) return 'lot_not_found';

      const nameConflict = await FarmLot.findOne({
        where: {
          farm_id: farm.id,
          name: validation.value.name,
          status: true,
          id: { [Op.ne]: lot.id },
        },
        transaction,
      });
      if (nameConflict) return 'lot_exists';

      const oldName = lot.name;
      const oldValues = {
        name: lot.name,
        size_hectares: lot.size_hectares,
        description: lot.description,
      };

      await lot.update(
        {
          name: validation.value.name,
          size_hectares: validation.value.size_hectares || null,
          description: validation.value.description || null,
        },
        { transaction },
      );

      if (oldName !== validation.value.name) {
        await FarmCrop.update(
          { area_section: validation.value.name },
          {
            where: {
              farm_id: farm.id,
              area_section: oldName,
            },
            transaction,
          },
        );
      }

      await createLandAudit(
        {
          action: 'update_farm_lot',
          recordId: farm.id,
          oldValues,
          newValues: {
            id: lot.id,
            name: lot.name,
            size_hectares: lot.size_hectares,
            description: lot.description,
          },
          userId: req.user.id,
        },
        transaction,
      );

      return { lot };
    });

    const errorResponse = handleLotOperationError(res, result);
    if (errorResponse) return errorResponse;

    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
      payload: result,
    });
  } catch (error) {
    console.error('Error al actualizar el lote del terreno:', error);
    return res.status(500).send('Error al actualizar el lote del terreno');
  }
};

export const deleteLandLot = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  const lotId = parseLandId(req.params.lotId);
  if (!farmId || !lotId) {
    return res.status(400).send('Identificador de terreno o lote inválido');
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';

      const lot = await FarmLot.findOne({
        where: {
          id: lotId,
          farm_id: farm.id,
          status: true,
        },
        transaction,
      });
      if (!lot) return 'lot_not_found';

      await lot.update({ status: false }, { transaction });

      await FarmCrop.update(
        { area_section: null },
        {
          where: {
            farm_id: farm.id,
            area_section: lot.name,
          },
          transaction,
        },
      );

      await createLandAudit(
        {
          action: 'delete_farm_lot',
          recordId: farm.id,
          oldValues: { id: lot.id, name: lot.name },
          userId: req.user.id,
        },
        transaction,
      );

      return 'deleted';
    });

    const errorResponse = handleLotOperationError(res, result);
    if (errorResponse) return errorResponse;

    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
    });
  } catch (error) {
    console.error('Error al eliminar el lote del terreno:', error);
    return res.status(500).send('Error al eliminar el lote del terreno');
  }
};
