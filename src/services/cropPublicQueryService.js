import { CROP_WORKFLOW_STATUSES } from './cropWorkflowService.js';

export const DEFAULT_PUBLIC_CROP_PAGE_SIZE = 8;
export const MAX_PUBLIC_CROP_PAGE_SIZE = 24;

const normalizeText = (value, maxLength) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, maxLength);

const normalizePositiveInteger = (value, fallback, maximum = Infinity) => {
  const candidate = normalizeText(value, 20);
  if (!/^[1-9]\d*$/.test(candidate)) return fallback;

  const number = Number(candidate);
  if (!Number.isSafeInteger(number)) return fallback;
  return Math.min(number, maximum);
};

export const normalizePublicCropQuery = (query = {}) => {
  const category = normalizeText(query.category, 100);

  return {
    search: normalizeText(query.search, 120),
    category: ['Categoría', 'Todas'].includes(category) ? '' : category,
    page: normalizePositiveInteger(query.page, 1),
    limit: normalizePositiveInteger(
      query.limit,
      DEFAULT_PUBLIC_CROP_PAGE_SIZE,
      MAX_PUBLIC_CROP_PAGE_SIZE,
    ),
  };
};

export const buildPublishedCropWhere = (Op, query) => {
  const where = {
    status: 'aprobado',
    workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
  };

  if (query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { scientific_name: { [Op.iLike]: `%${query.search}%` } },
      { description: { [Op.iLike]: `%${query.search}%` } },
      { family: { [Op.iLike]: `%${query.search}%` } },
    ];
  }

  if (query.category) where.category = query.category;
  return where;
};

export const parsePublicCropId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value ?? ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export const normalizePublicImagePath = (imagePath) => {
  if (!imagePath) return null;
  const relativePath = String(imagePath)
    .trim()
    .replace(/^\/+/, '')
    .replace(/^public\/+/, '');
  return relativePath ? `/${relativePath}` : null;
};

export const buildPublicCropCard = (cropRecord) => {
  const crop = cropRecord.toJSON();
  const primaryImage =
    crop.images?.find((image) => image.is_primary) || crop.images?.[0];

  return {
    id: crop.id,
    name: crop.name,
    scientificName: crop.scientific_name,
    category: crop.category || 'General',
    family: crop.family,
    description: crop.description,
    image_url: normalizePublicImagePath(
      primaryImage?.image_url || crop.image_url,
    ),
    climate: crop.climate,
    season: crop.season,
    harvest_days: crop.harvest_days,
    soil_type: crop.soil_type,
    water_requirement: crop.water_requirement,
  };
};
