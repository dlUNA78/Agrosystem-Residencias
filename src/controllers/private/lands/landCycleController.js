import db from '../../../models/index.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { generateLandCropStages } from '../../../services/landPhenologyService.js';
import {
  validateFarmCropInput,
  validateStageAdvanceInput,
} from '../../../services/landOperationalValidationService.js';
import { parseLandId } from '../../../services/landValidationService.js';
import {
  createLandAudit,
  findActiveFarmCrop,
  findActiveLand,
  sendOperationSuccess,
  sendValidationError,
} from './landControllerUtils.js';

const { Crop, FarmCrop, FarmCropStage, sequelize } = db;

const today = () => new Date().toISOString().slice(0, 10);

const sendOperationError = (res, result) => {
  if (result === 'farm_not_found') {
    return res.status(404).send('Predio no encontrado');
  }
  if (result === 'crop_not_found') {
    return res.status(400).send('Selecciona un cultivo publicado válido');
  }
  if (result === 'cycle_not_found') {
    return res.status(404).send('Ciclo de cultivo no encontrado');
  }
  return res.status(409).send('La etapa ya no puede avanzarse');
};

export const createLandCropCycle = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  if (!farmId) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateFarmCropInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';

      const crop = await Crop.findOne({
        where: {
          id: validation.value.crop_id,
          workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
        },
        transaction,
      });
      if (!crop) return 'crop_not_found';

      const farmCrop = await FarmCrop.create(
        {
          farm_id: farm.id,
          crop_id: crop.id,
          planting_date: validation.value.planting_date,
          area_section: validation.value.area_section || null,
          is_active: true,
          status: 'active',
        },
        { transaction },
      );
      const harvestDays = Number(crop.harvest_days) || 120;
      const stages = generateLandCropStages(
        validation.value.planting_date,
        harvestDays,
      ).map((stage) => ({ ...stage, farm_crop_id: farmCrop.id }));
      await FarmCropStage.bulkCreate(stages, { transaction });
      await createLandAudit(
        {
          action: 'create_crop_cycle',
          recordId: farm.id,
          newValues: {
            farm_crop_id: farmCrop.id,
            crop_id: crop.id,
            planting_date: validation.value.planting_date,
            area_section: validation.value.area_section || null,
          },
          userId: req.user.id,
        },
        transaction,
      );
      return { farmCropId: farmCrop.id };
    });

    if (typeof result === 'string') return sendOperationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
      status: 201,
      payload: result,
    });
  } catch (error) {
    console.error('Error al registrar el ciclo del terreno:', error);
    return res.status(500).send('Error al registrar el ciclo del terreno');
  }
};

export const advanceLandCropStage = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  if (!farmId) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateStageAdvanceInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';
      const farmCrop = await findActiveFarmCrop(
        farm.id,
        validation.value.farm_crop_id,
        transaction,
      );
      if (!farmCrop) return 'cycle_not_found';

      const stage = await FarmCropStage.findOne({
        where: {
          farm_crop_id: farmCrop.id,
          stage_order: validation.value.stage_order,
        },
        transaction,
      });
      if (!stage || stage.status !== 'in_progress') return 'invalid_stage';

      await stage.update(
        {
          status: 'completed',
          actual_date: today(),
          notes: validation.value.notes || stage.notes,
        },
        { transaction },
      );
      const nextStage = await FarmCropStage.findOne({
        where: {
          farm_crop_id: farmCrop.id,
          stage_order: validation.value.stage_order + 1,
        },
        transaction,
      });
      if (nextStage) {
        await nextStage.update({ status: 'in_progress' }, { transaction });
      } else {
        await farmCrop.update(
          { is_active: false, status: 'completed' },
          { transaction },
        );
      }
      await createLandAudit(
        {
          action: 'advance_crop_stage',
          recordId: farm.id,
          newValues: {
            farm_crop_id: farmCrop.id,
            stage_order: validation.value.stage_order,
          },
          userId: req.user.id,
        },
        transaction,
      );
      return 'advanced';
    });

    if (result !== 'advanced') return sendOperationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
    });
  } catch (error) {
    console.error('Error al avanzar la etapa del cultivo:', error);
    return res.status(500).send('Error al avanzar la etapa del cultivo');
  }
};

export const finishLandCropCycle = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  const farmCropId = parseLandId(req.body.farm_crop_id);
  if (!farmId || !farmCropId) {
    return res.status(400).send('El terreno o ciclo seleccionado no es válido');
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';
      const farmCrop = await findActiveFarmCrop(
        farm.id,
        farmCropId,
        transaction,
      );
      if (!farmCrop) return 'cycle_not_found';

      await farmCrop.update(
        { is_active: false, status: 'completed' },
        { transaction },
      );
      await createLandAudit(
        {
          action: 'finish_crop_cycle',
          recordId: farm.id,
          newValues: { farm_crop_id: farmCrop.id },
          userId: req.user.id,
        },
        transaction,
      );
      return 'finished';
    });

    if (result !== 'finished') return sendOperationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
    });
  } catch (error) {
    console.error('Error al finalizar el ciclo del cultivo:', error);
    return res.status(500).send('Error al finalizar el ciclo del cultivo');
  }
};
