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
  FarmLot,
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
  {
    model: FarmHealthReport,
    as: 'healthReports',
    required: false,
    include: [
      {
        model: FarmCrop,
        as: 'farmCrop',
        attributes: ['id', 'area_section'],
        include: [{ model: Crop, as: 'crop', attributes: ['id', 'name'] }],
      },
    ],
  },
  {
    model: FarmApplication,
    as: 'applications',
    required: false,
    include: [
      {
        model: FarmCrop,
        as: 'farmCrop',
        attributes: ['id', 'area_section'],
        include: [{ model: Crop, as: 'crop', attributes: ['id', 'name'] }],
      },
    ],
  },
  {
    model: FarmLot,
    as: 'lots',
    required: false,
    where: { status: true },
  },
];

const toDateOnly = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;

const prepareCropCycles = (cycles = []) =>
  cycles.map((cycle) => {
    const isArchived = cycle.status === 'archived';
    const isCompleted =
      cycle.status === 'completed' || (!cycle.is_active && !isArchived);
    const statusLabel = isArchived
      ? 'Archivado'
      : cycle.is_active
        ? 'En curso'
        : 'Cosechado / Finalizado';

    return {
      ...cycle,
      plantingDate: toDateOnly(cycle.planting_date),
      isArchived,
      isCompleted,
      statusLabel,
      ...summarizeLandCropStages(cycle.stages || [], {
        useTimeProgress: true,
        isCycleActive: cycle.is_active,
        cycleStatus: cycle.status,
      }),
    };
  });

const prepareHealthReports = (reports = []) => {
  const severityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' };
  return reports.map((report) => ({
    ...report,
    observedDate: toDateOnly(report.observed_at),
    severityLabel: severityLabels[report.severity] || report.severity,
    lotName: report.farmCrop?.area_section || 'General',
    cropName: report.farmCrop?.crop?.name || null,
  }));
};

const prepareApplications = (applications = []) =>
  applications.map((application) => ({
    ...application,
    appliedDate: toDateOnly(application.applied_at),
    lotName: application.farmCrop?.area_section || 'General',
    cropName: application.farmCrop?.crop?.name || null,
  }));

const prepareLandLots = (rawLots = [], farmCrops = []) => {
  const lotMap = new Map();

  rawLots.forEach((lot) => {
    lotMap.set(lot.name, {
      id: lot.id,
      name: lot.name,
      size_hectares: lot.size_hectares ? String(lot.size_hectares) : null,
      description: lot.description || null,
      isPersisted: true,
      activeCropsCount: 0,
    });
  });

  farmCrops.forEach((c) => {
    if (c.area_section && !lotMap.has(c.area_section)) {
      lotMap.set(c.area_section, {
        id: null,
        name: c.area_section,
        size_hectares: null,
        description: null,
        isPersisted: false,
        activeCropsCount: 0,
      });
    }
    if (c.area_section && c.is_active && lotMap.has(c.area_section)) {
      lotMap.get(c.area_section).activeCropsCount += 1;
    }
  });

  return Array.from(lotMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { numeric: true }),
  );
};

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
      attributes: ['id', 'name', 'scientific_name', 'category', 'harvest_days'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Plague.findAll({
      where: {
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        status: true,
      },
      attributes: ['id', 'name', 'scientific_name', 'category'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Product.findAll({
      where: { status: true },
      attributes: [
        'id',
        'name',
        'active_ingredient',
        'formulation_type',
        'category',
      ],
      include: [
        {
          model: Plague,
          as: 'plagues',
          attributes: ['id', 'name'],
          through: { attributes: [] },
          required: false,
        },
      ],
      order: [['name', 'ASC']],
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
    const [regions, crops, plagues, rawProducts] = await getCatalogs();
    const cropCategories = [
      ...new Set(crops.map((cropItem) => cropItem.category).filter(Boolean)),
    ].sort();
    const plagueCategories = [
      ...new Set(
        plagues.map((plagueItem) => plagueItem.category).filter(Boolean),
      ),
    ].sort();

    const products = rawProducts.map((prod) => {
      const p = prod.toJSON ? prod.toJSON() : prod;
      const targetPlagues = Array.isArray(p.plagues) ? p.plagues : [];
      const presentation = p.formulation_type || p.category || '';
      return {
        ...p,
        presentation,
        targetPlagueIds: targetPlagues.map((pl) => pl.id).join(','),
        targetPlagueNames: targetPlagues.map((pl) => pl.name).join(', '),
      };
    });

    const farmCrops = prepareCropCycles(land.farmCrops);
    const activeFarmCrops = farmCrops.filter((farmCrop) => farmCrop.is_active);
    const nonArchivedFarmCrops = farmCrops.filter(
      (farmCrop) => !farmCrop.isArchived,
    );
    const archivedFarmCrops = farmCrops.filter(
      (farmCrop) => farmCrop.isArchived,
    );
    const healthReports = prepareHealthReports(land.healthReports);
    const applications = prepareApplications(land.applications);
    const lots = prepareLandLots(land.lots || [], land.farmCrops || []);
    const permissions = buildPermissions(land, req.user);

    const detectedPlagues = [
      ...new Map(
        healthReports
          .filter((report) => report.plague_name)
          .map((report) => [
            report.plague_id || report.plague_name,
            {
              id: report.plague_id,
              name: report.plague_name,
              severity: report.severityLabel,
            },
          ]),
      ).values(),
    ];

    const detectedPlaguesByCrop = healthReports
      .filter((report) => report.plague_name)
      .map((report) => ({
        farmCropId: report.farm_crop_id ? String(report.farm_crop_id) : '',
        lotName: report.lotName || 'General',
        id: report.plague_id ? String(report.plague_id) : '',
        name: report.plague_name,
        severity: report.severityLabel,
      }));

    return res.render('private/lands/detail', {
      layout: privateLayout,
      pageTitle: `Expediente — ${land.name}`,
      activePage: 'lands',
      extraScripts: '<script src="/js/private/land-detail.js"></script>',
      land,
      regions,
      crops,
      cropCategories,
      plagues,
      plagueCategories,
      products,
      detectedPlagues,
      detectedPlaguesJson: JSON.stringify(detectedPlaguesByCrop),
      lots,
      lotsCount: lots.length,
      farmCrops,
      activeFarmCrops,
      nonArchivedFarmCrops,
      archivedFarmCrops,
      healthReports,
      applications,
      farmCropsCount: farmCrops.length,
      activeFarmCropsCount: activeFarmCrops.length,
      nonArchivedFarmCropsCount: nonArchivedFarmCrops.length,
      archivedFarmCropsCount: archivedFarmCrops.length,
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
