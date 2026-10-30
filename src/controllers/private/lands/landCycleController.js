import db from '../../../models/index.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { generateLandCropStages } from '../../../services/landPhenologyService.js';
import {
  validateFarmCropInput,
  validateStageAdvanceInput,
  validateStageRevertInput,
} from '../../../services/landOperationalValidationService.js';
import { parseLandId } from '../../../services/landValidationService.js';
import {
  createLandAudit,
  findActiveFarmCrop,
  findActiveLand,
  findFarmCrop,
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
  if (result === 'invalid_stage') {
    return res
      .status(400)
      .send('La etapa especificada no es válida para esta operación');
  }
  return res.status(409).send('La etapa ya no puede avanzarse');
};

const resolveCycleCrop = async (validatedInput, userId, transaction) => {
  if (validatedInput.crop_id) {
    return Crop.findOne({
      where: {
        id: validatedInput.crop_id,
        workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
      },
      transaction,
    });
  }

  if (validatedInput.custom_crop_name) {
    const existing = await Crop.findOne({
      where: { name: validatedInput.custom_crop_name },
      transaction,
    });
    if (existing) return existing;

    return Crop.create(
      {
        name: validatedInput.custom_crop_name,
        scientific_name: 'No especificado',
        category: 'Personalizado',
        harvest_days: validatedInput.custom_harvest_days || 120,
        workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
        status: 'aprobado',
        created_by_user_id: userId,
        updated_by_user_id: userId,
      },
      { transaction },
    );
  }

  return null;
};

const calculateHarvestDuration = (crop, validatedInput) => {
  if (validatedInput.estimated_harvest_date && validatedInput.planting_date) {
    const plantingMs = new Date(
      `${validatedInput.planting_date}T00:00:00.000Z`,
    ).getTime();
    const harvestMs = new Date(
      `${validatedInput.estimated_harvest_date}T00:00:00.000Z`,
    ).getTime();
    const diffDays = Math.round(
      (harvestMs - plantingMs) / (1000 * 60 * 60 * 24),
    );
    if (diffDays >= 1 && diffDays <= 3650) {
      return diffDays;
    }
  }
  if (validatedInput.custom_harvest_days) {
    return validatedInput.custom_harvest_days;
  }
  return Number(crop.harvest_days) || 120;
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

      const crop = await resolveCycleCrop(
        validation.value,
        req.user.id,
        transaction,
      );
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
      const farmCropId = farmCrop.get?.('id') ?? farmCrop.id;
      if (!farmCropId) {
        throw new Error('No se generó el identificador del ciclo de cultivo');
      }
      const harvestDays = calculateHarvestDuration(crop, validation.value);
      const stages = generateLandCropStages(
        validation.value.planting_date,
        harvestDays,
        today(),
      ).map((stage) => ({ ...stage, farm_crop_id: farmCropId }));
      await FarmCropStage.bulkCreate(stages, { transaction });
      await createLandAudit(
        {
          action: 'create_crop_cycle',
          recordId: farm.id,
          newValues: {
            farm_crop_id: farmCropId,
            crop_id: crop.id,
            planting_date: validation.value.planting_date,
            area_section: validation.value.area_section || null,
          },
          userId: req.user.id,
        },
        transaction,
      );
      return { farmCropId };
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

export const archiveLandCropCycle = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  const farmCropId = parseLandId(req.body.farm_crop_id);
  if (!farmId || !farmCropId) {
    return res.status(400).send('El terreno o ciclo seleccionado no es válido');
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';
      const farmCrop = await findFarmCrop(farm.id, farmCropId, transaction);
      if (!farmCrop) return 'cycle_not_found';

      const oldStatus = farmCrop.status;
      await farmCrop.update(
        { is_active: false, status: 'archived' },
        { transaction },
      );
      await createLandAudit(
        {
          action: 'archive_crop_cycle',
          recordId: farm.id,
          oldValues: { status: oldStatus, is_active: farmCrop.is_active },
          newValues: {
            farm_crop_id: farmCrop.id,
            status: 'archived',
            is_active: false,
          },
          userId: req.user.id,
        },
        transaction,
      );
      return 'archived';
    });

    if (result !== 'archived') return sendOperationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
    });
  } catch (error) {
    console.error('Error al archivar el ciclo del cultivo:', error);
    return res.status(500).send('Error al archivar el ciclo del cultivo');
  }
};

export const restoreLandCropCycle = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  const farmCropId = parseLandId(req.body.farm_crop_id);
  if (!farmId || !farmCropId) {
    return res.status(400).send('El terreno o ciclo seleccionado no es válido');
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';
      const farmCrop = await findFarmCrop(farm.id, farmCropId, transaction);
      if (!farmCrop) return 'cycle_not_found';

      await farmCrop.update(
        { is_active: false, status: 'completed' },
        { transaction },
      );
      await createLandAudit(
        {
          action: 'restore_crop_cycle',
          recordId: farm.id,
          newValues: { farm_crop_id: farmCrop.id, status: 'completed' },
          userId: req.user.id,
        },
        transaction,
      );
      return 'restored';
    });

    if (result !== 'restored') return sendOperationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
    });
  } catch (error) {
    console.error('Error al desarchivar el ciclo del cultivo:', error);
    return res.status(500).send('Error al desarchivar el ciclo del cultivo');
  }
};

const applyStageRevert = async (stages, targetOrder, notes, transaction) => {
  for (const st of stages) {
    if (st.stage_order < targetOrder) {
      if (st.status !== 'completed') {
        await st.update({ status: 'completed' }, { transaction });
      }
    } else if (st.stage_order === targetOrder) {
      await st.update(
        {
          status: 'in_progress',
          actual_date: null,
          notes: notes || st.notes,
        },
        { transaction },
      );
    } else {
      await st.update(
        {
          status: 'pending',
          actual_date: null,
        },
        { transaction },
      );
    }
  }
};

export const revertLandCropStage = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  if (!farmId) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateStageRevertInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const farm = await findActiveLand(farmId, req.user, transaction);
      if (!farm) return 'farm_not_found';
      const farmCrop = await findFarmCrop(
        farm.id,
        validation.value.farm_crop_id,
        transaction,
      );
      if (!farmCrop) return 'cycle_not_found';

      const targetOrder = validation.value.target_stage_order;
      const stages = await FarmCropStage.findAll({
        where: { farm_crop_id: farmCrop.id },
        order: [['stage_order', 'ASC']],
        transaction,
      });
      if (!stages || stages.length === 0) return 'invalid_stage';

      const targetStage = stages.find((s) => s.stage_order === targetOrder);
      if (!targetStage) return 'invalid_stage';

      await applyStageRevert(
        stages,
        targetOrder,
        validation.value.notes,
        transaction,
      );

      if (!farmCrop.is_active || farmCrop.status === 'completed') {
        await farmCrop.update(
          { is_active: true, status: 'active' },
          { transaction },
        );
      }

      await createLandAudit(
        {
          action: 'revert_crop_stage',
          recordId: farm.id,
          newValues: {
            farm_crop_id: farmCrop.id,
            target_stage_order: targetOrder,
            notes: validation.value.notes || null,
          },
          userId: req.user.id,
        },
        transaction,
      );

      return 'reverted';
    });

    if (result !== 'reverted') return sendOperationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
    });
  } catch (error) {
    console.error('Error al retroceder la etapa del cultivo:', error);
    return res.status(500).send('Error al retroceder la etapa del cultivo');
  }
};
