import db from '../models/index.js';

const { sequelize } = db;
const { QueryTypes } = db.Sequelize;

export const PRIVATE_CROP_FARMS_LIMIT = 12;

const NATIONAL_ACTIVE_FARMS_COUNT_SQL = `
  SELECT COUNT(DISTINCT fc.farm_id)::int AS total
  FROM "FarmCrops" fc
  INNER JOIN "Farms" f ON f.id = fc.farm_id
  WHERE fc.crop_id = :cropId
    AND fc.is_active = true
    AND f.status = true
`;

// Usa DISTINCT ON (fc.farm_id) para devolver predios distintos (no ciclos),
// ordenados por su ciclo activo más reciente (FarmCrops.createdAt DESC, id DESC),
// aprovechando idx_farm_crops_crop_id_active e idx_farms_user_status_created_id_desc.
const USER_ACTIVE_FARMS_SAMPLE_SQL = `
  WITH own_farms AS (
    SELECT DISTINCT ON (fc.farm_id)
      fc.farm_id,
      fc."createdAt" AS latest_created_at,
      fc.id AS latest_fc_id
    FROM "FarmCrops" fc
    INNER JOIN "Farms" f ON f.id = fc.farm_id
    WHERE fc.crop_id = :cropId
      AND fc.is_active = true
      AND f.status = true
      AND f.user_id = :userId
    ORDER BY fc.farm_id, fc."createdAt" DESC, fc.id DESC
  ),
  ranked AS (
    SELECT
      farm_id,
      latest_created_at,
      latest_fc_id,
      COUNT(*) OVER ()::int AS own_total_count
    FROM own_farms
    ORDER BY latest_created_at DESC, latest_fc_id DESC
    LIMIT :limit
  )
  SELECT
    f.id,
    f.name,
    f.municipality,
    f.farming_type,
    f.size_hectares,
    f.location_lat,
    f.location_lng,
    ranked.own_total_count
  FROM ranked
  INNER JOIN "Farms" f ON f.id = ranked.farm_id
  ORDER BY ranked.latest_created_at DESC, ranked.latest_fc_id DESC
`;

const toPositiveInteger = (value) => {
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
};

const stripOwnTotalCount = (row) => ({
  id: row.id,
  name: row.name,
  municipality: row.municipality,
  farming_type: row.farming_type,
  size_hectares: row.size_hectares,
  location_lat: row.location_lat,
  location_lng: row.location_lng,
});

export const countNationalActiveFarmsForCrop = async (cropId) => {
  const validCropId = toPositiveInteger(cropId);
  if (!validCropId) return 0;

  const [row] = await sequelize.query(NATIONAL_ACTIVE_FARMS_COUNT_SQL, {
    replacements: { cropId: validCropId },
    type: QueryTypes.SELECT,
  });

  return Number(row?.total) || 0;
};

export const findUserActiveFarmsForCrop = async (
  cropId,
  userId,
  { limit = PRIVATE_CROP_FARMS_LIMIT } = {},
) => {
  const validCropId = toPositiveInteger(cropId);
  const validUserId = toPositiveInteger(userId);
  const safeLimit = toPositiveInteger(limit) || PRIVATE_CROP_FARMS_LIMIT;

  if (!validCropId || !validUserId) {
    return { farms: [], ownFarmsCount: 0 };
  }

  const rows = await sequelize.query(USER_ACTIVE_FARMS_SAMPLE_SQL, {
    replacements: {
      cropId: validCropId,
      userId: validUserId,
      limit: safeLimit,
    },
    type: QueryTypes.SELECT,
  });

  const ownFarmsCount =
    rows.length > 0 ? Number(rows[0].own_total_count) || rows.length : 0;

  return {
    farms: rows.map(stripOwnTotalCount),
    ownFarmsCount,
  };
};

export const loadPrivateCropFarmSummary = async (
  cropId,
  userId,
  { limit = PRIVATE_CROP_FARMS_LIMIT } = {},
) => {
  const [farmsCount, userFarms] = await Promise.all([
    countNationalActiveFarmsForCrop(cropId),
    findUserActiveFarmsForCrop(cropId, userId, { limit }),
  ]);

  return {
    farmsCount,
    ownFarmsCount: userFarms.ownFarmsCount,
    farms: userFarms.farms,
  };
};
