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

const resolveReportPlague = async (validatedInput, transaction) => {
  if (validatedInput.plague_id) {
    const plague = await Plague.findOne({
      where: {
        id: validatedInput.plague_id,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        status: true,
      },
      transaction,
    });
    if (!plague) return null;
    return { plagueId: plague.id, plagueName: plague.name };
  }

  if (validatedInput.custom_plague_name) {
    const existing = await Plague.findOne({
      where: { name: validatedInput.custom_plague_name },
      transaction,
    });
    return {
      plagueId: existing?.id || null,
      plagueName: validatedInput.custom_plague_name,
    };
  }

  return null;
};

const resolveApplicationProduct = async (validatedInput, transaction) => {
  if (validatedInput.product_id) {
    const product = await Product.findOne({
      where: { id: validatedInput.product_id, status: true },
      transaction,
    });
    if (!product) return null;
    return {
      productId: product.id,
      productName: product.name,
      activeIngredient: product.active_ingredient || null,
    };
  }

  if (validatedInput.custom_product_name) {
    return {
      productId: null,
      productName: validatedInput.custom_product_name,
      activeIngredient:
        validatedInput.custom_active_ingredient || 'No especificado',
    };
  }

  return null;
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

      const plagueData = await resolveReportPlague(
        validation.value,
        transaction,
      );
      if (!plagueData) return 'catalog_not_found';

      const report = await FarmHealthReport.create(
        {
          ...validation.value,
          farm_id: context.farm.id,
          farm_crop_id: context.farmCrop?.id || null,
          plague_id: plagueData.plagueId,
          plague_name: plagueData.plagueName,
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
            plague_id: plagueData.plagueId,
            plague_name: plagueData.plagueName,
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

      const productData = await resolveApplicationProduct(
        validation.value,
        transaction,
      );
      if (!productData) return 'catalog_not_found';

      const application = await FarmApplication.create(
        {
          ...validation.value,
          farm_id: context.farm.id,
          farm_crop_id: context.farmCrop?.id || null,
          product_id: productData.productId,
          product_name: productData.productName,
          active_ingredient: productData.activeIngredient,
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
            product_id: productData.productId,
            product_name: productData.productName,
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
