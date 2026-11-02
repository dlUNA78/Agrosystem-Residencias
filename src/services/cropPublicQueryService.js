import { CROP_WORKFLOW_STATUSES } from './cropWorkflowService.js';

export const DEFAULT_PUBLIC_CROP_PAGE_SIZE = 8;
export const MAX_PUBLIC_CROP_PAGE_SIZE = 24;

export const PUBLIC_CROP_CATEGORIES = Object.freeze([
  'Granos y Cereales',
  'Frutales',
  'Hortalizas',
  'Leguminosas',
  'Oleaginosas',
  'Tubérculos',
  'Forrajeras',
  'Ornamentales',
  'Industriales',
  'Otro',
]);

export const PUBLIC_CROP_SEASONS = Object.freeze([
  'Primavera–Verano',
  'Otoño–Invierno',
  'Perenne',
]);

const categoryAliases = new Map([
  ['cereal', 'Granos y Cereales'],
  ['cereales', 'Granos y Cereales'],
  ['granos y cereales', 'Granos y Cereales'],
  ['frutal', 'Frutales'],
  ['frutales', 'Frutales'],
  ['hortaliza', 'Hortalizas'],
  ['hortalizas', 'Hortalizas'],
  ['leguminosa', 'Leguminosas'],
  ['leguminosas', 'Leguminosas'],
  ['oleaginosa', 'Oleaginosas'],
  ['oleaginosas', 'Oleaginosas'],
  ['tuberculo', 'Tubérculos'],
  ['tubérculo', 'Tubérculos'],
  ['tubérculos', 'Tubérculos'],
  ['forrajera', 'Forrajeras'],
  ['forrajeras', 'Forrajeras'],
  ['ornamental', 'Ornamentales'],
  ['ornamentales', 'Ornamentales'],
  ['industrial', 'Industriales'],
  ['industriales', 'Industriales'],
  ['otro', 'Otro'],
]);

const categoryVariants = new Map([
  ['Granos y Cereales', ['Granos y Cereales', 'Cereales', 'Cereal']],
  ['Frutales', ['Frutales', 'Frutal']],
  ['Hortalizas', ['Hortalizas', 'Hortaliza']],
  ['Leguminosas', ['Leguminosas', 'Leguminosa']],
  ['Oleaginosas', ['Oleaginosas', 'Oleaginosa']],
  ['Tubérculos', ['Tubérculos', 'Tubérculo', 'Tuberculo']],
  ['Forrajeras', ['Forrajeras', 'Forrajera']],
  ['Ornamentales', ['Ornamentales', 'Ornamental']],
  ['Industriales', ['Industriales', 'Industrial']],
  ['Otro', ['Otro']],
]);

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
  const normalizedCategory = category
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

  return {
    search: normalizeText(query.search, 120),
    category: ['categoría', 'todas', ''].includes(category.toLowerCase())
      ? ''
      : categoryAliases.get(normalizedCategory) || '',
    season: normalizeText(query.season, 50),
    page: normalizePositiveInteger(query.page, 1),
    limit: normalizePositiveInteger(
      query.limit,
      DEFAULT_PUBLIC_CROP_PAGE_SIZE,
      MAX_PUBLIC_CROP_PAGE_SIZE,
    ),
  };
};

export const buildPublicCropPageUrl = (page, query = {}) => {
  const params = new URLSearchParams({ page: String(page) });
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.season) params.set('season', query.season);
  return `/crops?${params.toString()}`;
};

export const buildPublishedCropWhere = (Op, query) => {
  const where = {
    status: 'aprobado',
    workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
  };

  const conditions = [];

  if (query.search) {
    conditions.push({
      [Op.or]: [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { common_name: { [Op.iLike]: `%${query.search}%` } },
        { scientific_name: { [Op.iLike]: `%${query.search}%` } },
        { description: { [Op.iLike]: `%${query.search}%` } },
        { family: { [Op.iLike]: `%${query.search}%` } },
        { botanical_family: { [Op.iLike]: `%${query.search}%` } },
        { variety: { [Op.iLike]: `%${query.search}%` } },
      ],
    });
  }

  if (query.category) {
    const variants = categoryVariants.get(query.category) || [query.category];
    where.category = { [Op.in]: variants };
  }

  if (query.season) {
    conditions.push({
      [Op.or]: [
        { season: { [Op.iLike]: `%${query.season}%` } },
        { planting_season: { [Op.iLike]: `%${query.season}%` } },
      ],
    });
  }

  if (conditions.length > 0) {
    where[Op.and] = conditions;
  }

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
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^public\/+/, '');
  return relativePath ? `/${relativePath}` : null;
};

const resolveCardImage = (crop) => {
  const primaryImage =
    crop.images?.find((image) => image.is_primary) || crop.images?.[0];
  return normalizePublicImagePath(primaryImage?.image_url || crop.image_url);
};

const resolveCardCycle = (crop) => {
  if (crop.growth_cycle) return crop.growth_cycle;
  if (crop.harvest_days) return `${crop.harvest_days} días`;
  return crop.cycle || null;
};

const resolveCardSeason = (crop) => crop.planting_season || crop.season || null;

export const buildPublicCropCard = (cropRecord) => {
  const crop =
    typeof cropRecord.toJSON === 'function' ? cropRecord.toJSON() : cropRecord;

  const imageUrl = resolveCardImage(crop);
  const cycleValue = resolveCardCycle(crop);
  const seasonValue = resolveCardSeason(crop);
  const commonName = crop.common_name || crop.name;
  const family = crop.botanical_family || crop.family;
  const climate = crop.optimal_climate || crop.climate;
  const plaguesCount = Array.isArray(crop.plagues) ? crop.plagues.length : 0;

  return {
    id: crop.id,
    name: crop.name,
    commonName,
    scientificName: crop.scientific_name,
    category: crop.category || 'General',
    family,
    description: crop.description,
    image_url: imageUrl,
    imageUrl,
    climate,
    season: seasonValue,
    growthCycle: cycleValue,
    harvest_days: crop.harvest_days,
    soil_type: crop.soil_type,
    water_requirement: crop.water_requirement,
    plaguesCount,
  };
};
