import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';
import { getLandPermissions } from '../../services/landAuthorizationService.js';
import {
  buildLandListCsv,
  buildLandListGeoJson,
} from '../../services/landExportService.js';
import {
  buildFilteredLandWhere,
  buildLandsPaginationState,
  computeLandStatsInMemory,
  DEFAULT_LANDS_PAGE_SIZE,
  FARMING_TYPES,
  fetchLandScopeStats,
  normalizeLandListQuery,
  serializeFarm,
} from '../../services/landListQueryService.js';
import { validateLandInput } from '../../services/landValidationService.js';
import { createRegionalBulletinRecord } from '../../services/regionalBulletinService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { AuditLog, Farm, Region, User, sequelize } = db;

const STABLE_LANDS_ORDER = [
  ['createdAt', 'DESC'],
  ['id', 'DESC'],
];

const regionInclude = {
  model: Region,
  as: 'region',
  attributes: ['id', 'name'],
  required: false,
};

const ownerInclude = {
  model: User,
  as: 'user',
  attributes: ['id', 'full_name'],
  required: false,
};

const wantsJson = (req) =>
  Boolean(req.xhr || req.headers?.accept?.includes('application/json'));

const sendInputError = (req, res, fieldErrors) => {
  const errors = Object.values(fieldErrors).flat();
  if (wantsJson(req)) {
    return res.status(400).json({ success: false, errors, fieldErrors });
  }
  return res.status(400).send(errors.join(' '));
};

const handleExportResponse = (res, format, filteredFarms) => {
  if (format === 'csv') {
    const csv = buildLandListCsv(filteredFarms);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="padron-predios-inifap.csv"',
    );
    return res.status(200).send(csv);
  }
  if (format === 'geojson') {
    const geojson = buildLandListGeoJson(filteredFarms);
    res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="padron-predios-inifap.geojson"',
    );
    return res.status(200).json(geojson);
  }
  return null;
};

const exportFilteredLands = async (req, res, filteredWhere) => {
  const format = String(req.query?.format || '').toLowerCase();
  if (format !== 'csv' && format !== 'geojson') return null;

  const rows = await Farm.findAll({
    where: filteredWhere,
    include: [regionInclude, ownerInclude],
    order: STABLE_LANDS_ORDER,
    subQuery: false,
  });
  const serialized = rows.map((farm) => serializeFarm(farm, req.user));
  return handleExportResponse(res, format, serialized);
};

const countFilteredFarms = async (filteredWhere, query, scopeStats) => {
  const hasFilters = Boolean(query.search || query.region || query.farmingType);
  if (!hasFilters && scopeStats) {
    return scopeStats.total;
  }
  if (typeof Farm.count === 'function') {
    return Farm.count({ where: filteredWhere });
  }
  return scopeStats ? scopeStats.total : null;
};

const loadPaginatedLandsData = async (user, query) => {
  const [regions, scopeStats] = await Promise.all([
    Region.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    fetchLandScopeStats(sequelize, user, query.status),
  ]);

  const filteredWhere = buildFilteredLandWhere(user, query, { regions });
  const filteredTotal = await countFilteredFarms(
    filteredWhere,
    query,
    scopeStats,
  );
  const prePagination = buildLandsPaginationState(
    filteredTotal ?? DEFAULT_LANDS_PAGE_SIZE,
    query.requestedPage,
    DEFAULT_LANDS_PAGE_SIZE,
    query,
  );

  const pageRows = await Farm.findAll({
    where: filteredWhere,
    include: [regionInclude, ownerInclude],
    order: STABLE_LANDS_ORDER,
    limit: prePagination.pageSize,
    offset: filteredTotal !== null ? prePagination.offset : 0,
    subQuery: false,
  });

  const farms = pageRows.map((farm) => serializeFarm(farm, user));
  const stats = scopeStats || computeLandStatsInMemory(farms);
  const pagination = buildLandsPaginationState(
    filteredTotal ?? farms.length,
    query.requestedPage,
    DEFAULT_LANDS_PAGE_SIZE,
    query,
  );

  return { regions, farms, stats, pagination };
};

const buildLandsViewModel = ({
  user,
  permissions,
  query,
  regions,
  farms,
  stats,
  pagination,
}) => {
  const role = user?.role || '';
  const hasActiveFilters = Boolean(
    query.search || query.region || query.farmingType,
  );

  return {
    layout: privateLayout,
    pageTitle: permissions.canViewAll ? 'Terrenos' : 'Mis Terrenos',
    activePage: 'lands',
    isAdmin: role === 'admin',
    isInifap: role === 'inifap',
    farms,
    pageFarmsCount: farms.length,
    pageGeoCount: farms.filter((f) => f.hasCoords).length,
    regions: regions.map((r) => ({
      ...r,
      selected: String(r.id) === query.region,
    })),
    farmingTypes: FARMING_TYPES.map((value) => ({
      value,
      selected: value === query.farmingType,
    })),
    farmsCount: pagination.totalCount,
    totalScopeCount: stats.total,
    stats,
    pagination,
    permissions,
    hasActiveFilters,
    filters: {
      status: query.status,
      search: query.search,
      region: query.region,
      farmingType: query.farmingType,
      isActive: query.status === 'active',
      isArchived: query.status === 'archived',
      isAll: query.status === 'all',
    },
    extraHead: '<link rel="stylesheet" href="/vendor/leaflet/leaflet.css" />',
    extraScripts: `
      <script src="/vendor/leaflet/leaflet.js"></script>
      <script type="module" src="/js/private/lands.js"></script>
    `,
  };
};

export const renderLandsPrivate = async (req, res) => {
  try {
    const permissions = getLandPermissions(req.user.role);
    const query = normalizeLandListQuery(req.query);

    if (req.query?.format) {
      const regions = query.search
        ? await Region.findAll({
            attributes: ['id', 'name'],
            order: [['name', 'ASC']],
            raw: true,
          })
        : null;
      const filteredWhere = buildFilteredLandWhere(req.user, query, {
        regions,
      });
      const exported = await exportFilteredLands(req, res, filteredWhere);
      if (exported) return exported;
    }

    const { regions, farms, stats, pagination } = await loadPaginatedLandsData(
      req.user,
      query,
    );

    return res.render(
      'private/lands/list',
      buildLandsViewModel({
        user: req.user,
        permissions,
        query,
        regions,
        farms,
        stats,
        pagination,
      }),
    );
  } catch (error) {
    console.error('Error al cargar los terrenos:', error);
    return res.status(500).send('Error al cargar los terrenos');
  }
};

export const createFarmPrivate = async (req, res) => {
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

    await sequelize.transaction(async (transaction) => {
      const farm = await Farm.create(
        {
          ...validation.value,
          user_id: req.user.id,
          status: true,
        },
        { transaction },
      );
      await AuditLog.create(
        {
          action: 'create',
          table_name: 'Farms',
          record_id: farm.id,
          old_values: null,
          new_values: validation.value,
          user_id: req.user.id,
        },
        { transaction },
      );
    });

    if (wantsJson(req)) return res.status(201).json({ success: true });
    return res.redirect('/private/lands');
  } catch (error) {
    console.error('Error al crear el terreno:', error);
    return res.status(500).send('Error al crear el terreno');
  }
};

export const createRegionalBulletinHandler = async (req, res) => {
  try {
    const result = await createRegionalBulletinRecord({
      payload: req.body,
      user: req.user,
    });
    if (!result.success) {
      return sendInputError(req, res, { general: [result.message] });
    }
    const redirectTo =
      req.body?.redirect_to === 'public' ? '/lands' : '/private/lands';
    if (wantsJson(req)) return res.status(201).json({ success: true });
    return res.redirect(redirectTo);
  } catch (error) {
    console.error('Error al publicar boletín regional:', error);
    return res.status(500).send('Error al publicar boletín regional');
  }
};

export { landDetail } from './lands/landDetailController.js';
export {
  archiveFarmPrivate,
  deleteFarmPrivate,
  restoreFarmPrivate,
  updateFarmPrivate,
} from './lands/landMutationController.js';
export {
  advanceLandCropStage,
  archiveLandCropCycle,
  createLandCropCycle,
  finishLandCropCycle,
  restoreLandCropCycle,
  revertLandCropStage,
} from './lands/landCycleController.js';
export {
  createFarmApplication,
  createFarmHealthReport,
} from './lands/landRecordController.js';
export {
  createLandLot,
  deleteLandLot,
  updateLandLot,
} from './lands/landLotController.js';
