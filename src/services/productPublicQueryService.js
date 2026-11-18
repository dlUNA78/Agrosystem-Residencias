import {
  PRODUCT_CATEGORIES,
  PRODUCT_HAZARD_BANDS,
  normalizeHazardCategory,
  resolveProductHazardTheme,
} from './productValidationService.js';
import { PRODUCT_WORKFLOW_STATUSES } from './productWorkflowService.js';
import { buildAccentInsensitiveRegex } from '../utils/validators.js';

export const DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE = 8;
export const MAX_PUBLIC_PRODUCT_PAGE_SIZE = 24;

const categoryLookup = new Map(
  PRODUCT_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

const hazardByCode = new Map(
  PRODUCT_HAZARD_BANDS.map((band) => [band.code, band.value]),
);

const clean = (value, max) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, max);

const positiveInteger = (value, fallback, maximum = Infinity) => {
  const normalized = clean(value, 20);
  if (!/^[1-9]\d*$/.test(normalized)) return fallback;
  const number = Number(normalized);
  return Number.isSafeInteger(number) ? Math.min(number, maximum) : fallback;
};

const optionalPositiveId = (value) => positiveInteger(value, null);

const normalizeCategoryFilter = (rawCategory) => {
  const cleaned = clean(rawCategory, 60).toLowerCase();
  if (!cleaned || cleaned === 'categoría' || cleaned === 'todas') return '';
  return categoryLookup.get(cleaned) || '';
};

const normalizeHazardFilter = (rawHazard) => {
  const cleaned = clean(rawHazard, 120);
  if (!cleaned || cleaned.toLowerCase() === 'todas') return '';
  return (
    hazardByCode.get(cleaned.toLowerCase()) ||
    normalizeHazardCategory(cleaned) ||
    ''
  );
};

export const normalizePublicProductQuery = (query = {}) => ({
  search: clean(query.search, 120),
  category: normalizeCategoryFilter(query.category),
  hazard: normalizeHazardFilter(query.hazard),
  cropId: optionalPositiveId(query.crop),
  plagueId: optionalPositiveId(query.plague),
  page: positiveInteger(query.page, 1),
  limit: positiveInteger(
    query.limit,
    DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE,
    MAX_PUBLIC_PRODUCT_PAGE_SIZE,
  ),
});

export const buildPublicProductPageUrl = (page, query = {}) => {
  const params = new URLSearchParams({ page: String(page) });
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.hazard) params.set('hazard', query.hazard);
  if (query.cropId) params.set('crop', String(query.cropId));
  if (query.plagueId) params.set('plague', String(query.plagueId));
  return `/products?${params.toString()}`;
};

export const buildPublishedProductWhere = (Op, query = {}) => {
  const where = {
    status: true,
    workflow_status: PRODUCT_WORKFLOW_STATUSES.PUBLISHED,
  };

  if (query.search) {
    const accentRegex = buildAccentInsensitiveRegex(query.search);
    where[Op.or] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { active_ingredient: { [Op.iLike]: `%${query.search}%` } },
      { manufacturer: { [Op.iLike]: `%${query.search}%` } },
      { category: { [Op.iLike]: `%${query.search}%` } },
      { registration_code: { [Op.iLike]: `%${query.search}%` } },
      { formulation_type: { [Op.iLike]: `%${query.search}%` } },
      ...(Op.iRegexp && accentRegex
        ? [
            { name: { [Op.iRegexp]: accentRegex } },
            { active_ingredient: { [Op.iRegexp]: accentRegex } },
            { manufacturer: { [Op.iRegexp]: accentRegex } },
            { category: { [Op.iRegexp]: accentRegex } },
          ]
        : []),
    ];
  }

  if (query.category) {
    where.category = query.category;
  }

  if (query.hazard) {
    where.hazard_category = query.hazard;
  }

  return where;
};

export const parsePublicProductId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value ?? ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export const normalizeProductImagePath = (value) => {
  if (!value) return null;
  const relative = String(value)
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^public\/+/, '');
  return relative ? `/${relative}` : null;
};

const formatSafetyIntervalShort = (days) => {
  if (days === null || days === undefined || days === '') return null;
  const num = Number(days);
  if (!Number.isInteger(num) || num < 0) return null;
  return num === 0 ? 'Sin límite (0 d)' : `${num} d a cosecha`;
};

const sortImages = (images = []) =>
  images
    .map((image) => ({
      is_primary: Boolean(image.is_primary),
      display_order: Number(image.display_order) || 0,
      image_url: normalizeProductImagePath(image.image_url),
    }))
    .filter((image) => image.image_url)
    .sort(
      (first, second) =>
        Number(second.is_primary) - Number(first.is_primary) ||
        first.display_order - second.display_order,
    );

export const buildPublicProductCard = (record) => {
  const product =
    typeof record.toJSON === 'function' ? record.toJSON() : record;
  const images = sortImages(product.images);
  const primaryUrl =
    images[0]?.image_url ||
    normalizeProductImagePath(product.image_url) ||
    '/images/products/default.png';
  const hazardTheme = resolveProductHazardTheme(product.hazard_category);

  return {
    id: product.id,
    name: product.name,
    category: product.category || 'Fitosanitario',
    active_ingredient: product.active_ingredient,
    registration_code: product.registration_code,
    manufacturer: product.manufacturer,
    validation_status: product.validation_status,
    expiration_date: product.expiration_date,
    target_crops: product.target_crops,
    description: product.description,
    mode_of_action: product.mode_of_action,
    hazard_category: product.hazard_category,
    hazardTheme,
    suggested_dosage: product.suggested_dosage,
    safety_interval_days: product.safety_interval_days,
    safetyIntervalShort: formatSafetyIntervalShort(
      product.safety_interval_days,
    ),
    formulation_type: product.formulation_type,
    safety_sheet_url: product.safety_sheet_url,
    plagues: product.plagues || [],
    crops: product.crops || [],
    plaguesCount: Array.isArray(product.plagues) ? product.plagues.length : 0,
    cropsCount: Array.isArray(product.crops) ? product.crops.length : 0,
    images,
    image_url: primaryUrl,
  };
};
