import db from '../../../models/index.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';
import {
  validateFarmApplicationInput,
  validateFarmHealthReportInput,
} from '../../../services/landOperationalValidationService.js';
import { parseLandId } from '../../../services/landValidationService.js';
import {
  createLandAudit,
  findActiveFarmCrop,
  findActiveLand,
  sendOperationSuccess,
  sendValidationError,
} from './landControllerUtils.js';

const { FarmApplication, FarmHealthReport, Plague, Product, sequelize } = db;

const getFarmAndCycle = async (farmId, farmCropId, user, transaction) => {
  const farm = await findActiveLand(farmId, user, transaction);
  if (!farm) return { error: 'farm_not_found' };
  if (!farmCropId) return { farm, farmCrop: null };

  const farmCrop = await findActiveFarmCrop(farm.id, farmCropId, transaction);
  return farmCrop ? { farm, farmCrop } : { error: 'cycle_not_found' };
};

const sendRelationError = (res, error) => {
  if (error === 'farm_not_found') {
    return res.status(404).send('Predio no encontrado');
  }
  if (error === 'cycle_not_found') {
    return res
      .status(400)
      .send('El ciclo seleccionado no pertenece al terreno');
  }
  return res.status(400).send('Selecciona un registro publicado del catálogo');
};

export const createFarmHealthReport = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  if (!farmId) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateFarmHealthReportInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const context = await getFarmAndCycle(
        farmId,
        validation.value.farm_crop_id,
        req.user,
        transaction,
      );
      if (context.error) return context.error;

      const plague = await Plague.findOne({
        where: {
          id: validation.value.plague_id,
          workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
          status: true,
        },
        transaction,
      });
      if (!plague) return 'catalog_not_found';

      const report = await FarmHealthReport.create(
        {
          ...validation.value,
          farm_id: context.farm.id,
          farm_crop_id: context.farmCrop?.id || null,
          plague_name: plague.name,
          status: 'open',
          created_by_user_id: req.user.id,
        },
        { transaction },
      );
      await createLandAudit(
        {
          action: 'create_health_report',
          recordId: context.farm.id,
          newValues: {
            health_report_id: report.id,
            farm_crop_id: context.farmCrop?.id || null,
            plague_id: plague.id,
            severity: validation.value.severity,
          },
          userId: req.user.id,
        },
        transaction,
      );
      return { reportId: report.id };
    });

    if (typeof result === 'string') return sendRelationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
      status: 201,
      payload: result,
    });
  } catch (error) {
    console.error('Error al registrar el hallazgo del terreno:', error);
    return res.status(500).send('Error al registrar el hallazgo del terreno');
  }
};

export const createFarmApplication = async (req, res) => {
  const farmId = parseLandId(req.params.id);
  if (!farmId) return res.status(400).send('Identificador de terreno inválido');

  const validation = validateFarmApplicationInput(req.body);
  if (!validation.isValid) {
    return sendValidationError(req, res, validation.fieldErrors);
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const context = await getFarmAndCycle(
        farmId,
        validation.value.farm_crop_id,
        req.user,
        transaction,
      );
      if (context.error) return context.error;

      const product = await Product.findOne({
        where: { id: validation.value.product_id, status: true },
        transaction,
      });
      if (!product) return 'catalog_not_found';

      const application = await FarmApplication.create(
        {
          ...validation.value,
          farm_id: context.farm.id,
          farm_crop_id: context.farmCrop?.id || null,
          product_name: product.name,
          active_ingredient: product.active_ingredient || null,
          created_by_user_id: req.user.id,
        },
        { transaction },
      );
      await createLandAudit(
        {
          action: 'create_application',
          recordId: context.farm.id,
          newValues: {
            application_id: application.id,
            farm_crop_id: context.farmCrop?.id || null,
            product_id: product.id,
            dose_value: validation.value.dose_value,
            dose_unit: validation.value.dose_unit,
          },
          userId: req.user.id,
        },
        transaction,
      );
      return { applicationId: application.id };
    });

    if (typeof result === 'string') return sendRelationError(res, result);
    return sendOperationSuccess(req, res, {
      redirectTo: `/private/lands/${farmId}/expediente`,
      status: 201,
      payload: result,
    });
  } catch (error) {
    console.error('Error al registrar la aplicación del terreno:', error);
    return res.status(500).send('Error al registrar la aplicación del terreno');
  }
};
