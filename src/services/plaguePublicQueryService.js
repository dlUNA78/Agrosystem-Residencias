import { PLAGUE_WORKFLOW_STATUSES } from './plagueWorkflowService.js';

export const DEFAULT_PUBLIC_PLAGUE_PAGE_SIZE = 8;
export const MAX_PUBLIC_PLAGUE_PAGE_SIZE = 24;

const categoryAliases = new Map([
  ['insecto', 'Insectos'],
  ['insectos', 'Insectos'],
  ['hongo', 'Hongos'],
  ['hongos', 'Hongos'],
  ['bacteria', 'Bacterias'],
  ['bacterias', 'Bacterias'],
  ['virus', 'Virus'],
  ['acaro', 'Ácaros'],
  ['acaros', 'Ácaros'],
]);

const riskAliases = new Map([
  ['critico', 'Crítico'],
  ['alto', 'Crítico'],
  ['moderado', 'Moderado'],
  ['medio', 'Moderado'],
  ['bajo', 'Bajo'],
]);
const riskVariants = new Map([
  ['Crítico', ['Alto', 'Crítico']],
  ['Moderado', ['Medio', 'Moderado']],
  ['Bajo', ['Bajo']],
]);
const categoryVariants = new Map([
  ['Insectos', ['Insecto', 'Insectos']],
  ['Hongos', ['Hongo', 'Hongos']],
  ['Bacterias', ['Bacteria', 'Bacterias']],
  ['Virus', ['Virus']],
  ['Ácaros', ['Ácaro', 'Ácaros']],
]);

const normalizeText = (value, maxLength = 120) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, maxLength);

const normalizeKey = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const normalizePositiveInteger = (value, fallback, maximum = Infinity) => {
  const candidate = normalizeText(value, 20);
  if (!/^[1-9]\d*$/.test(candidate)) return fallback;
  const number = Number(candidate);
  return Number.isSafeInteger(number) ? Math.min(number, maximum) : fallback;
};

export const normalizePublicPlagueQuery = (query = {}) => ({
  search: normalizeText(query.search),
  category: categoryAliases.get(normalizeKey(query.category)) || '',
  region: normalizeText(query.region, 150).replace(/^Región$/i, ''),
  risk: riskAliases.get(normalizeKey(query.risk)) || '',
  page: normalizePositiveInteger(query.page, 1),
  limit: normalizePositiveInteger(
    query.limit,
    DEFAULT_PUBLIC_PLAGUE_PAGE_SIZE,
    MAX_PUBLIC_PLAGUE_PAGE_SIZE,
  ),
});

export const buildPublishedPlagueQuery = ({
  Op,
  query,
  Region,
  PlagueImage,
}) => {
  const where = {
    status: true,
    workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
  };

  if (query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { scientific_name: { [Op.iLike]: `%${query.search}%` } },
      { description: { [Op.iLike]: `%${query.search}%` } },
    ];
  }
  if (query.category) {
    where.category = { [Op.in]: categoryVariants.get(query.category) };
  }
  if (query.risk) {
    where.risk_level = { [Op.in]: riskVariants.get(query.risk) };
  }

  const include = [
    {
      model: PlagueImage,
      as: 'images',
      required: false,
      separate: true,
      order: [['sort_order', 'ASC']],
    },
  ];

  if (query.region) {
    include.push({
      model: Region,
      as: 'regions',
      attributes: [],
      through: { attributes: [] },
      where: { name: query.region },
      required: true,
    });
  }

  return { where, include };
};

export const buildPublicPlaguePageUrl = (page, query = {}) => {
  const params = new URLSearchParams({ page: String(page) });
  for (const key of ['search', 'category', 'region', 'risk']) {
    if (query[key]) params.set(key, query[key]);
  }
  return `/plagues?${params.toString()}`;
};
