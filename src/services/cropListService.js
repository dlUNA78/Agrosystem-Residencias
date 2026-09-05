import { CROP_WORKFLOW_STATUSES } from './cropWorkflowService.js';

export const PRIVATE_CROP_PAGE_SIZE = 12;

const allowedCategories = new Set([
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

const normalizeText = (value, maxLength = 120) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, maxLength);

const normalizePage = (value) => {
  const candidate = normalizeText(value, 20);
  if (!/^[1-9]\d*$/.test(candidate)) return 1;
  const page = Number(candidate);
  return Number.isSafeInteger(page) ? page : 1;
};

export const normalizePrivateCropListQuery = (query = {}) => {
  const category = normalizeText(query.category, 100);
  const workflow = normalizeText(query.workflow, 32);

  return {
    page: normalizePage(query.page),
    search: normalizeText(query.search),
    category: allowedCategories.has(category) ? category : '',
    workflow: Object.values(CROP_WORKFLOW_STATUSES).includes(workflow)
      ? workflow
      : '',
  };
};

const buildPageUrl = (page, filters) => {
  const params = new URLSearchParams({ page: String(page) });

  for (const key of ['search', 'category', 'workflow']) {
    if (filters[key]) params.set(key, filters[key]);
  }

  return `/private/crops?${params.toString()}`;
};

export const buildPrivateCropPagination = ({
  requestedPage,
  totalItems,
  filters = {},
}) => {
  const safeTotalItems = Math.max(0, Number(totalItems) || 0);
  const totalPages = Math.max(
    1,
    Math.ceil(safeTotalItems / PRIVATE_CROP_PAGE_SIZE),
  );
  const currentPage = Math.min(
    Math.max(1, Number(requestedPage) || 1),
    totalPages,
  );
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  return {
    currentPage,
    totalPages,
    totalItems: safeTotalItems,
    fromItem:
      safeTotalItems === 0 ? 0 : (currentPage - 1) * PRIVATE_CROP_PAGE_SIZE + 1,
    toItem: Math.min(currentPage * PRIVATE_CROP_PAGE_SIZE, safeTotalItems),
    hasMultiplePages: totalPages > 1,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    prevUrl: currentPage > 1 ? buildPageUrl(currentPage - 1, filters) : null,
    nextUrl:
      currentPage < totalPages ? buildPageUrl(currentPage + 1, filters) : null,
    pages: Array.from({ length: end - start + 1 }, (_, index) => {
      const page = start + index;
      return {
        number: page,
        isCurrent: page === currentPage,
        url: buildPageUrl(page, filters),
      };
    }),
  };
};

export const CROP_CATEGORY_OPTIONS = Object.freeze(
  [...allowedCategories].map((category) => ({
    value: category,
    text: category,
  })),
);
