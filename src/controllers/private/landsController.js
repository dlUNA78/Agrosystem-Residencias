import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';
import {
  getContextualLandPermissions,
  getLandListWhere,
  getLandPermissions,
} from '../../services/landAuthorizationService.js';
import { validateLandInput } from '../../services/landValidationService.js';
import { createRegionalBulletinRecord } from '../../services/regionalBulletinService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { AuditLog, Farm, Region, User, sequelize } = db;

const FARMING_TYPES = Object.freeze([
  'Temporal',
  'Riego',
  'Mixto',
  'Tecnificado',
  'Orgánico',
  'Hidroponía',
]);

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

const getRequestedListStatus = (value) =>
  value === 'archived' || value === 'all' ? value : 'active';

const normalizeFilterQuery = (rawQuery = {}) => ({
  status: getRequestedListStatus(rawQuery.status),
  search: String(rawQuery.search || '')
    .trim()
    .slice(0, 100),
  region: String(rawQuery.region || '').trim(),
  farmingType: String(rawQuery.farmingType || '').trim(),
});

const hasFarmCoords = (farm) => {
  const lat = Number(farm.location_lat);
  const lng = Number(farm.location_lng);
  return (
    farm.location_lat !== null &&
    farm.location_lat !== undefined &&
    farm.location_lat !== '' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
};

const serializeFarm = (farm, user) => {
  const value = farm.toJSON();
  return {
    ...value,
    codeLabel: `#PRD-${String(value.id).padStart(4, '0')}`,
    hasCoords: hasFarmCoords(value),
    formattedHectares: value.size_hectares
      ? Number(value.size_hectares).toLocaleString('es-MX', {
          maximumFractionDigits: 2,
        })
      : null,
    permissions: getContextualLandPermissions({
      role: user.role,
      userId: user.id,
      ownerUserId: value.user_id,
      isActive: value.status,
    }),
  };
};

const matchesFarmSearch = (farm, normalizedSearch) => {
  if (!normalizedSearch) return true;
  const haystack = [
    farm.name,
    farm.municipality,
    farm.farming_type,
    farm.region?.name,
    farm.user?.full_name,
    farm.codeLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(normalizedSearch);
};

const filterFarmsInMemory = (farms, query) => {
  const searchLower = query.search.toLowerCase();
  return farms.filter((farm) => {
    const byRegion =
      !query.region ||
      String(farm.region_id || farm.region?.id || '') === query.region;
    const byType =
      !query.farmingType ||
      String(farm.farming_type || '') === query.farmingType;
    return byRegion && byType && matchesFarmSearch(farm, searchLower);
  });
};

const computeLandStats = (farms) => {
  const totalHectaresRaw = farms.reduce(
    (acc, farm) => acc + (Number(farm.size_hectares) || 0),
    0,
  );
  const regionIds = new Set(
    farms.map((f) => f.region_id || f.region?.id).filter(Boolean),
  );
  return {
    total: farms.length,
    totalHectares: totalHectaresRaw.toLocaleString('es-MX', {
      maximumFractionDigits: 2,
    }),
    georeferenced: farms.filter((f) => f.hasCoords).length,
    regionsCovered: regionIds.size,
  };
};

export const renderLandsPrivate = async (req, res) => {
  try {
    const permissions = getLandPermissions(req.user.role);
    const query = normalizeFilterQuery(req.query);
    const [regions, farms] = await Promise.all([
      Region.findAll({
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
        raw: true,
      }),
      Farm.findAll({
        where: getLandListWhere(req.user, { status: query.status }),
        include: [regionInclude, ownerInclude],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const allScopeFarms = farms.map((farm) => serializeFarm(farm, req.user));
    const filteredFarms = filterFarmsInMemory(allScopeFarms, query);
    const stats = computeLandStats(allScopeFarms);
    const role = req.user?.role || '';

    return res.render('private/lands/list', {
      layout: privateLayout,
      pageTitle: permissions.canViewAll ? 'Terrenos' : 'Mis Terrenos',
      activePage: 'lands',
      isAdmin: role === 'admin',
      isInifap: role === 'inifap',
      farms: filteredFarms,
      regions: regions.map((r) => ({
        ...r,
        selected: String(r.id) === query.region,
      })),
      farmingTypes: FARMING_TYPES.map((value) => ({
        value,
        selected: value === query.farmingType,
      })),
      farmsCount: filteredFarms.length,
      totalScopeCount: allScopeFarms.length,
      stats,
      permissions,
      hasActiveFilters: Boolean(
        query.search || query.region || query.farmingType,
      ),
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
    });
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
