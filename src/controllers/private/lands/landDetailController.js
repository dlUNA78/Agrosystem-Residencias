import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../../models/index.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import {
  getContextualLandPermissions,
  getLandListWhere,
} from '../../../services/landAuthorizationService.js';
import { summarizeLandCropStages } from '../../../services/landPhenologyService.js';
import { parseLandId } from '../../../services/landValidationService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateLayout = path.join(__dirname, '../../../views/layouts/private');

const {
  Crop,
  Farm,
  FarmApplication,
  FarmCrop,
  FarmCropStage,
  FarmHealthReport,
  Plague,
  Product,
  Region,
  User,
} = db;

const operationalIncludes = [
  {
    model: FarmCrop,
    as: 'farmCrops',
    required: false,
    include: [
      {
        model: Crop,
        as: 'crop',
        attributes: ['id', 'name', 'scientific_name', 'harvest_days'],
      },
      { model: FarmCropStage, as: 'stages', required: false },
    ],
  },
  { model: FarmHealthReport, as: 'healthReports', required: false },
  { model: FarmApplication, as: 'applications', required: false },
];

const toDateOnly = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

const prepareCropCycles = (cycles = []) =>
  cycles.map((cycle) => ({
    ...cycle,
    plantingDate: toDateOnly(cycle.planting_date),
    statusLabel: cycle.is_active ? 'En curso' : 'Finalizado',
    ...summarizeLandCropStages(cycle.stages || []),
  }));

const prepareHealthReports = (reports = []) => {
  const severityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' };
  return reports.map((report) => ({
    ...report,
    observedDate: toDateOnly(report.observed_at),
    severityLabel: severityLabels[report.severity] || report.severity,
  }));
};

const prepareApplications = (applications = []) =>
  applications.map((application) => ({
    ...application,
    appliedDate: toDateOnly(application.applied_at),
  }));

const buildPermissions = (land, user) =>
  getContextualLandPermissions({
    role: user.role,
    userId: user.id,
    ownerUserId: land.user_id,
    isActive: land.status,
  });

const getCatalogs = () =>
  Promise.all([
    Region.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Crop.findAll({
      where: { workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED },
      attributes: ['id', 'name', 'scientific_name'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Plague.findAll({
      where: {
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        status: true,
      },
      attributes: ['id', 'name', 'scientific_name'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Product.findAll({
      where: { status: true },
      attributes: ['id', 'name', 'active_ingredient'],
      order: [['name', 'ASC']],
      raw: true,
    }),
  ]);

export const landDetail = async (req, res) => {
  const id = parseLandId(req.params.id);
  if (!id) return res.status(400).send('Identificador de terreno inválido');

  try {
    const farm = await Farm.findOne({
      where: { ...getLandListWhere(req.user, { status: 'all' }), id },
      include: [
        {
          model: Region,
          as: 'region',
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name'],
          required: false,
        },
        ...operationalIncludes,
      ],
    });
    if (!farm) return res.status(404).send('Predio no encontrado');

    const land = farm.toJSON();
    const [regions, crops, plagues, products] = await getCatalogs();
    const farmCrops = prepareCropCycles(land.farmCrops);
    const healthReports = prepareHealthReports(land.healthReports);
    const applications = prepareApplications(land.applications);
    const permissions = buildPermissions(land, req.user);

    return res.render('private/lands/detail', {
      layout: privateLayout,
      pageTitle: `Expediente — ${land.name}`,
      activePage: 'lands',
      extraScripts: '<script src="/js/private/land-detail.js"></script>',
      land,
      regions,
      crops,
      plagues,
      products,
      farmCrops,
      activeFarmCrops: farmCrops.filter((farmCrop) => farmCrop.is_active),
      healthReports,
      applications,
      farmCropsCount: farmCrops.length,
      healthReportsCount: healthReports.length,
      applicationsCount: applications.length,
      today: new Date().toISOString().slice(0, 10),
      permissions,
      landLat: land.location_lat ? String(land.location_lat) : 'N/A',
      landLng: land.location_lng ? String(land.location_lng) : 'N/A',
      landHectares: land.size_hectares ? String(land.size_hectares) : '0',
      landId: `#PRD-${String(land.id).padStart(4, '0')}`,
    });
  } catch (error) {
    console.error('Error al obtener el expediente del terreno:', error);
    return res.status(500).send('Error al obtener el expediente del terreno');
  }
};
