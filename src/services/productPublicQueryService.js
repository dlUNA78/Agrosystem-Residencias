import { PRODUCT_WORKFLOW_STATUSES } from './productWorkflowService.js';

export const DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE = 8;
export const MAX_PUBLIC_PRODUCT_PAGE_SIZE = 24;

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

export const normalizePublicProductQuery = (query = {}) => ({
  search: clean(query.search, 120),
  page: positiveInteger(query.page, 1),
  limit: positiveInteger(
    query.limit,
    DEFAULT_PUBLIC_PRODUCT_PAGE_SIZE,
    MAX_PUBLIC_PRODUCT_PAGE_SIZE,
  ),
});

export const buildPublishedProductWhere = (Op, query) => {
  const where = {
    status: true,
    workflow_status: PRODUCT_WORKFLOW_STATUSES.PUBLISHED,
  };
  if (query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { active_ingredient: { [Op.iLike]: `%${query.search}%` } },
      { manufacturer: { [Op.iLike]: `%${query.search}%` } },
      { category: { [Op.iLike]: `%${query.search}%` } },
    ];
  }
  return where;
};

export const parsePublicProductId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value ?? ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};
