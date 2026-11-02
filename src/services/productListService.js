import {
  PRODUCT_CATEGORIES,
  PRODUCT_HAZARD_BANDS,
  normalizeHazardCategory,
} from './productValidationService.js';
import { PRODUCT_WORKFLOW_STATUSES } from './productWorkflowService.js';

export const PRIVATE_PRODUCT_PAGE_SIZE = 12;

const validWorkflowStatuses = new Set(Object.values(PRODUCT_WORKFLOW_STATUSES));
const hazardByCode = new Map(
  PRODUCT_HAZARD_BANDS.map((band) => [band.code, band.value]),
);

const clean = (value, max = 120) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, max);

const positivePage = (value) => {
  const str = clean(value, 12);
  if (!/^[1-9]\d*$/.test(str)) return 1;
  const num = Number(str);
  return Number.isSafeInteger(num) ? num : 1;
};

const normalizeHazard = (raw) => {
  const cleaned = clean(raw, 120);
  if (!cleaned) return '';
  return (
    hazardByCode.get(cleaned.toLowerCase()) ||
    normalizeHazardCategory(cleaned) ||
    ''
  );
};

export const normalizePrivateProductListQuery = (query = {}) => {
  const search = clean(query.search, 120);
  const category = clean(query.category, 50);
  const workflowRaw = clean(query.workflow || query.status, 32);
  const hazard = normalizeHazard(query.hazard);

  return {
    search,
    category: PRODUCT_CATEGORIES.includes(category) ? category : '',
    workflow: validWorkflowStatuses.has(workflowRaw) ? workflowRaw : '',
    hazard,
    page: positivePage(query.page),
  };
};

export const buildPrivateProductPageUrl = (page, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.workflow) params.set('workflow', filters.workflow);
  if (filters.hazard) params.set('hazard', filters.hazard);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/private/products?${qs}` : '/private/products';
};

export const buildPrivateProductPagination = ({
  requestedPage = 1,
  totalItems = 0,
  filters = {},
} = {}) => {
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / PRIVATE_PRODUCT_PAGE_SIZE),
  );
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const fromItem =
    totalItems === 0 ? 0 : (currentPage - 1) * PRIVATE_PRODUCT_PAGE_SIZE + 1;
  const toItem = Math.min(currentPage * PRIVATE_PRODUCT_PAGE_SIZE, totalItems);

  const pages = Array.from({ length: totalPages }, (_, index) => {
    const number = index + 1;
    return {
      number,
      isCurrent: number === currentPage,
      url: buildPrivateProductPageUrl(number, filters),
    };
  });

  return {
    currentPage,
    totalPages,
    totalItems,
    fromItem,
    toItem,
    hasMultiplePages: totalPages > 1,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    prevUrl: buildPrivateProductPageUrl(Math.max(1, currentPage - 1), filters),
    nextUrl: buildPrivateProductPageUrl(
      Math.min(totalPages, currentPage + 1),
      filters,
    ),
    pages,
  };
};
