import { Op } from 'sequelize';
import {
  getContextualLandPermissions,
  getLandListWhere,
} from './landAuthorizationService.js';

export const DEFAULT_LANDS_PAGE_SIZE = 12;

export const FARMING_TYPES = Object.freeze([
  'Temporal',
  'Riego',
  'Mixto',
  'Tecnificado',
  'Orgánico',
  'Hidroponía',
]);

export const getRequestedListStatus = (value) =>
  value === 'archived' || value === 'all' ? value : 'active';

const parsePositiveRegionId = (rawRegion) => {
  const clean = String(rawRegion || '').trim();
  if (!/^\d+$/.test(clean)) return { region: '', regionId: null };
  const parsed = Number.parseInt(clean, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return { region: '', regionId: null };
  }
  return { region: String(parsed), regionId: parsed };
};

const parseRequestedPage = (rawPage) => {
  const parsed = Number.parseInt(String(rawPage ?? '1').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
};

export const clampLandsPage = (requestedPage, totalPages) => {
  const safeTotal = Math.max(
    1,
    Number.parseInt(String(totalPages || 1), 10) || 1,
  );
  const parsed = parseRequestedPage(requestedPage);
  return Math.min(parsed, safeTotal);
};

export const normalizeLandListQuery = (rawQuery = {}) => {
  const status = getRequestedListStatus(rawQuery.status);
  const search = String(rawQuery.search || '')
    .trim()
    .slice(0, 100);
  const { region, regionId } = parsePositiveRegionId(rawQuery.region);
  const rawType = String(rawQuery.farmingType || '').trim();
  const farmingType = FARMING_TYPES.includes(rawType) ? rawType : '';
  const requestedPage = parseRequestedPage(rawQuery.page);

  return {
    status,
    search,
    region,
    regionId,
    farmingType,
    requestedPage,
  };
};

const isFiniteCoord = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

export const hasFarmCoords = (farm) =>
  isFiniteCoord(farm?.location_lat) && isFiniteCoord(farm?.location_lng);

export const serializeFarm = (farm, user) => {
  const value =
    typeof farm?.toJSON === 'function' ? farm.toJSON() : { ...farm };
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
      role: user?.role,
      userId: user?.id,
      ownerUserId: value.user_id,
      isActive: value.status,
    }),
  };
};

export const computeLandStatsInMemory = (farms = []) => {
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
    georeferenced: farms.filter((f) => hasFarmCoords(f)).length,
    regionsCovered: regionIds.size,
  };
};

const toNumberOrZero = (value, fallback = 0) => Number(value ?? fallback) || 0;

export const formatLandStatsFromAggregateRow = (row = {}) => {
  const total = toNumberOrZero(row.total);
  const totalHectaresRaw = toNumberOrZero(row.totalHectaresRaw);

  return {
    total,
    totalHectares: totalHectaresRaw.toLocaleString('es-MX', {
      maximumFractionDigits: 2,
    }),
    georeferenced: toNumberOrZero(row.georeferenced),
    regionsCovered: toNumberOrZero(row.regionsCovered),
    statusCounts: {
      active: toNumberOrZero(row.activeCount, total),
      archived: toNumberOrZero(row.archivedCount),
      all: toNumberOrZero(row.allCount, total),
    },
  };
};

const SCOPE_SQL_CONDITION = Object.freeze({
  active: '"status" = true',
  archived: '"status" = false',
  all: 'TRUE',
});

export const fetchLandScopeStats = async (
  sequelize,
  user,
  status = 'active',
) => {
  const baseWhere = getLandListWhere(user, { status });
  const userId = Number(baseWhere.user_id);
  if (!Number.isInteger(userId) || typeof sequelize?.query !== 'function') {
    return null;
  }

  const scopeCond = SCOPE_SQL_CONDITION[status] || SCOPE_SQL_CONDITION.active;
  const sql = `
    SELECT
      COUNT(*)::int AS "allCount",
      COUNT(*) FILTER (WHERE "status" = true)::int AS "activeCount",
      COUNT(*) FILTER (WHERE "status" = false)::int AS "archivedCount",
      COUNT(*) FILTER (WHERE ${scopeCond})::int AS "total",
      COALESCE(SUM("size_hectares") FILTER (WHERE ${scopeCond}), 0) AS "totalHectaresRaw",
      COUNT(*) FILTER (
        WHERE ${scopeCond}
          AND "location_lat" IS NOT NULL
          AND "location_lng" IS NOT NULL
      )::int AS "georeferenced",
      COUNT(DISTINCT "region_id") FILTER (
        WHERE ${scopeCond}
          AND "region_id" IS NOT NULL
      )::int AS "regionsCovered"
    FROM "Farms"
    WHERE "user_id" = :userId
  `;

  const [rows] = await sequelize.query(sql, {
    replacements: { userId },
  });
  return formatLandStatsFromAggregateRow(rows?.[0] || {});
};

export const escapeIlikePattern = (rawSearch) =>
  String(rawSearch || '').replace(/[\\%_]/g, '\\$&');

const parsePrdCodeId = (rawSearch) => {
  const match = String(rawSearch || '')
    .trim()
    .match(/^#?(?:prd-?)?0*(\d+)$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const findMatchingRegionIds = (regions, searchLower) =>
  regions
    .filter((r) =>
      String(r?.name || '')
        .toLowerCase()
        .includes(searchLower),
    )
    .map((r) => Number(r.id))
    .filter((id) => Number.isInteger(id) && id > 0);

const buildSearchOrClauses = (rawSearch, { op = Op, regions = null } = {}) => {
  const searchLower = rawSearch.toLowerCase();
  const pattern = `%${escapeIlikePattern(rawSearch)}%`;
  const orClauses = [
    { name: { [op.iLike]: pattern } },
    { municipality: { [op.iLike]: pattern } },
    { farming_type: { [op.iLike]: pattern } },
  ];

  if (Array.isArray(regions)) {
    const matchedRegionIds = findMatchingRegionIds(regions, searchLower);
    if (matchedRegionIds.length > 0) {
      orClauses.push({ region_id: { [op.in]: matchedRegionIds } });
    }
  } else {
    orClauses.push({ '$region.name$': { [op.iLike]: pattern } });
  }

  const codeId = parsePrdCodeId(rawSearch);
  if (codeId !== null) {
    orClauses.push({ id: codeId });
  }

  return orClauses;
};

const doesOwnerNameMatchSearch = (user, rawSearch) =>
  Boolean(
    user?.full_name &&
    String(user.full_name)
      .toLowerCase()
      .includes(String(rawSearch).toLowerCase()),
  );

export const buildFilteredLandWhere = (
  user,
  query,
  { op = Op, regions = null } = {},
) => {
  const where = { ...getLandListWhere(user, { status: query.status }) };

  if (query.regionId) {
    where.region_id = query.regionId;
  }
  if (query.farmingType) {
    where.farming_type = query.farmingType;
  }
  if (query.search && !doesOwnerNameMatchSearch(user, query.search)) {
    const orClauses = buildSearchOrClauses(query.search, { op, regions });
    where[op.and] = [{ [op.or]: orClauses }];
  }

  return where;
};

export const buildLandsFilterSuffix = (query) => {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);
  if (query.region) params.set('region', query.region);
  if (query.farmingType) params.set('farmingType', query.farmingType);
  const serialized = params.toString();
  return serialized ? `&${serialized}` : '';
};

export const buildLandsPaginationState = (
  totalFilteredCount,
  requestedPage,
  pageSize = DEFAULT_LANDS_PAGE_SIZE,
  query = {},
) => {
  const safeCount = Math.max(0, Number(totalFilteredCount) || 0);
  const totalPages = Math.max(1, Math.ceil(safeCount / pageSize) || 1);
  const currentPage = clampLandsPage(requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const startRecord = safeCount > 0 ? offset + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, safeCount);
  const filterSuffix = buildLandsFilterSuffix(query);

  return {
    totalCount: safeCount,
    pageSize,
    currentPage,
    totalPages,
    offset,
    startRecord,
    endRecord,
    hasMultiplePages: totalPages > 1,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    prevPage: Math.max(1, currentPage - 1),
    nextPage: Math.min(totalPages, currentPage + 1),
    filterSuffix,
    prevUrl: `/private/lands?page=${Math.max(1, currentPage - 1)}${filterSuffix}`,
    nextUrl: `/private/lands?page=${Math.min(totalPages, currentPage + 1)}${filterSuffix}`,
  };
};
