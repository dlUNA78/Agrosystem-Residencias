import { PLAGUE_WORKFLOW_STATUSES } from './plagueWorkflowService.js';

export const PRIVATE_PLAGUE_PAGE_SIZE = 12;

const allowedCategories = new Set([
  'Insecto',
  'Insectos',
  'Hongo',
  'Hongos',
  'Bacteria',
  'Virus',
  'Ácaro',
  'Ácaros',
]);

const normalizeText = (value, maxLength = 120) => {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replaceAll('\0', '').trim().slice(0, maxLength);
};

const normalizePage = (value) => {
  const candidate = String(value || '').trim();

  if (!/^[1-9]\d*$/.test(candidate)) {
    return 1;
  }

  const page = Number(candidate);
  return Number.isSafeInteger(page) ? page : 1;
};

export const normalizePrivatePlagueListQuery = (query = {}) => {
  const category = normalizeText(query.category, 100);
  const workflow = normalizeText(query.workflow, 32);

  return {
    page: normalizePage(query.page),
    search: normalizeText(query.search),
    category: allowedCategories.has(category) ? category : '',
    workflow: Object.values(PLAGUE_WORKFLOW_STATUSES).includes(workflow)
      ? workflow
      : '',
  };
};

const buildPageUrl = (basePath, page, filters) => {
  const params = new URLSearchParams();
  params.set('page', String(page));

  for (const key of ['search', 'category', 'workflow']) {
    if (filters[key]) {
      params.set(key, filters[key]);
    }
  }

  return `${basePath}?${params.toString()}`;
};

const buildPageWindow = (currentPage, totalPages) => {
  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

export const buildPrivatePlaguePagination = ({
  requestedPage,
  totalItems,
  filters = {},
  basePath = '/private/plagues',
}) => {
  const safeTotalItems = Math.max(0, Number(totalItems) || 0);
  const totalPages = Math.max(
    1,
    Math.ceil(safeTotalItems / PRIVATE_PLAGUE_PAGE_SIZE),
  );
  const currentPage = Math.min(
    Math.max(1, Number(requestedPage) || 1),
    totalPages,
  );
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  return {
    currentPage,
    totalPages,
    totalItems: safeTotalItems,
    fromItem:
      safeTotalItems === 0
        ? 0
        : (currentPage - 1) * PRIVATE_PLAGUE_PAGE_SIZE + 1,
    toItem: Math.min(currentPage * PRIVATE_PLAGUE_PAGE_SIZE, safeTotalItems),
    hasMultiplePages: totalPages > 1,
    hasPrevPage,
    hasNextPage,
    firstUrl: buildPageUrl(basePath, 1, filters),
    lastUrl: buildPageUrl(basePath, totalPages, filters),
    prevUrl: hasPrevPage
      ? buildPageUrl(basePath, currentPage - 1, filters)
      : null,
    nextUrl: hasNextPage
      ? buildPageUrl(basePath, currentPage + 1, filters)
      : null,
    pages: buildPageWindow(currentPage, totalPages).map((page) => ({
      number: page,
      isCurrent: page === currentPage,
      url: buildPageUrl(basePath, page, filters),
    })),
  };
};
