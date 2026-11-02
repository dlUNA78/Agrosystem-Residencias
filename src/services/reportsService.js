import db from '../models/index.js';
import { getLandListWhere } from './landAuthorizationService.js';

const { Farm, FarmHealthReport, FarmApplication, Product, User, Sequelize } =
  db;

const { Op } = Sequelize;

export const MONTH_ABBRS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const PALETTE = ['#1b4332', '#2d6a4f', '#40916c', '#d97706', '#e11d48'];

const CATEGORY_COLORS = {
  herbicida: '#1b4332',
  insecticida: '#0f172a',
  fungicida: '#059669',
  fertilizante: '#d97706',
  otros: '#64748b',
};

const DONUT_RADIUS = 44;
const DONUT_CIRCUMFERENCE = Number((2 * Math.PI * DONUT_RADIUS).toFixed(2));

/**
 * Normaliza y sanea los parámetros de consulta de reportes
 */
export const normalizeReportQuery = (query = {}) => {
  const allowedPeriods = ['semanal', 'mensual', 'trimestral', 'anual'];
  const rawPeriod =
    typeof query.period === 'string' ? query.period.trim().toLowerCase() : '';
  const period = allowedPeriods.includes(rawPeriod) ? rawPeriod : 'mensual';

  const allowedFormats = ['csv', 'pdf'];
  const rawFormat =
    typeof query.format === 'string' ? query.format.trim().toLowerCase() : '';
  const format = allowedFormats.includes(rawFormat) ? rawFormat : '';

  const allowedTypes = ['general', 'health', 'applications'];
  const rawType =
    typeof query.reportType === 'string'
      ? query.reportType.trim().toLowerCase()
      : '';
  const reportType = allowedTypes.includes(rawType) ? rawType : 'general';

  const farmId = query.farmId ? Number(query.farmId) || null : null;

  return { period, format, reportType, farmId };
};

/**
 * Calcula el rango de fechas [startDate, endDate] para el período seleccionado
 */
export const getPeriodDateRange = (period, referenceDate = new Date()) => {
  const periodDaysMap = {
    semanal: 7,
    mensual: 30,
    trimestral: 90,
    anual: 365,
  };

  const days = periodDaysMap[period] ?? 30;
  const startDate = new Date(referenceDate);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(referenceDate);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate, days };
};

/**
 * Formatea una fecha a representación humana legible sin desfase por zona horaria
 */
export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return 'Sin fecha';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [year, month, day] = dateStr.slice(0, 10).split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = MONTH_ABBRS[monthIndex] ?? month;
    return `${parseInt(day, 10)} ${monthName} ${year}`;
  }

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const day = d.getDate();
  const monthName = MONTH_ABBRS[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return `${day} ${monthName} ${year}`;
};

/**
 * Extrae las iniciales de dos caracteres de un nombre completo
 */
export const getTechnicianInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'TK';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase() || 'TK';
};

/**
 * Retorna las clases visuales de Tailwind según la categoría de producto
 */
export const getCategoryBadgeClass = (category) => {
  const norm = (category || '').toLowerCase();
  const badgeMap = {
    herbicida: 'bg-primary/10 text-primary',
    insecticida: 'bg-red-50 text-red-600',
    fungicida: 'bg-blue-50 text-blue-600',
    fertilizante: 'bg-amber-50 text-amber-600',
  };
  return badgeMap[norm] ?? 'bg-slate-100 text-slate-600';
};

export const getActiveFarmIds = async (user, farmId) => {
  const farmWhere = getLandListWhere(user, { status: 'active' });
  if (farmId) {
    farmWhere.id = farmId;
  }

  const farms = await Farm.findAll({
    where: farmWhere,
    attributes: ['id'],
    raw: true,
  });

  return farms.map((f) => f.id);
};

export const buildFarmScope = (user, farmId) => {
  const farmWhere = getLandListWhere(user, { status: 'active' });
  if (farmId) {
    farmWhere.id = farmId;
  }

  return {
    farmWhere,
    includeFarm: {
      model: Farm,
      as: 'farm',
      where: farmWhere,
      required: true,
      attributes: ['id', 'name', 'municipality', 'size_hectares'],
    },
  };
};

export const calculateKpis = async (dateRange, user, farmId) => {
  const { startDate, endDate } = dateRange;
  const { farmWhere } = buildFarmScope(user, farmId);
  const farmIds = await getActiveFarmIds(user, farmId);

  if (farmIds.length === 0) {
    return {
      reportedPlagues: 0,
      chemicalApplications: 0,
      criticalAlerts: 0,
      monitoredFarms: 0,
      formattedHectares: '0 ha',
    };
  }

  const dateFilter = {
    farm_id: { [Op.in]: farmIds },
    createdAt: { [Op.between]: [startDate, endDate] },
  };

  const criticalFilter = {
    ...dateFilter,
    severity: { [Op.in]: ['high', 'critical'] },
  };

  const [
    reportedPlagues,
    chemicalApplications,
    criticalAlerts,
    monitoredFarms,
    totalHectaresSum,
  ] = await Promise.all([
    FarmHealthReport.count({ where: dateFilter }),
    FarmApplication.count({ where: dateFilter }),
    FarmHealthReport.count({ where: criticalFilter }),
    Farm.count({ where: farmWhere }),
    Farm.sum('size_hectares', { where: farmWhere }),
  ]);

  const hectares = Number(totalHectaresSum) || 0;
  const formattedHectares = `${hectares.toLocaleString('es-MX', {
    maximumFractionDigits: 1,
  })} ha`;

  return {
    reportedPlagues,
    chemicalApplications,
    criticalAlerts,
    monitoredFarms,
    formattedHectares,
  };
};

const buildRecentMonthsSequence = (count = 4, referenceDate = new Date()) => {
  const list = [];
  const ref = new Date(referenceDate);

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    list.push({
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      label: MONTH_ABBRS[d.getMonth()],
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      count: 0,
    });
  }
  return list;
};

const attachSvgBarMetrics = (months, maxCount) =>
  months.map((m, idx) => {
    const heightPercentage =
      maxCount > 0 ? Math.max(12, Math.round((m.count / maxCount) * 100)) : 8;
    const barHeight = Math.max(8, Math.round((heightPercentage / 100) * 102));
    const barX = 28 + idx * 82;
    const barY = 126 - barHeight;

    return {
      label: m.label,
      count: m.count,
      heightPercentage,
      barColor: m.count > 0 ? '#1b4332' : '#e2e8f0',
      barX,
      barY,
      barWidth: 46,
      barHeight,
      centerX: barX + 23,
      countY: Math.max(14, barY - 6),
    };
  });

export const calculateMonthlyApplications = async (
  dateRange,
  user,
  farmId,
  referenceDate = new Date(),
) => {
  const { startDate, endDate } = dateRange;
  const farmIds = await getActiveFarmIds(user, farmId);
  const months = buildRecentMonthsSequence(4, referenceDate);

  if (farmIds.length === 0) {
    return attachSvgBarMetrics(months, 0);
  }

  const applications = await FarmApplication.findAll({
    where: {
      farm_id: { [Op.in]: farmIds },
      createdAt: { [Op.between]: [startDate, endDate] },
    },
    attributes: ['id', 'applied_at', 'createdAt'],
    raw: true,
  });

  const countByMonth = new Map();
  for (const app of applications) {
    const date = new Date(app.applied_at || app.createdAt);
    if (!Number.isNaN(date.getTime())) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      countByMonth.set(key, (countByMonth.get(key) || 0) + 1);
    }
  }

  let maxCount = 0;
  for (const item of months) {
    item.count = countByMonth.get(item.key) || 0;
    if (item.count > maxCount) maxCount = item.count;
  }

  return attachSvgBarMetrics(months, maxCount);
};

const normalizeCategory = (category) => {
  const val = (category || '').toLowerCase().trim();
  if (val.includes('herbicida')) return 'Herbicidas';
  if (val.includes('insecticida')) return 'Insecticidas';
  if (val.includes('fungicida')) return 'Fungicidas';
  if (val.includes('fertilizante') || val.includes('abono')) {
    return 'Fertilizantes';
  }
  return 'Otros';
};

const buildDonutSegments = (counts, total) => {
  let currentPercent = 0;
  let cumulativeArc = 0;
  const gradientStops = [];
  const types = [];

  for (const [name, count] of counts.entries()) {
    const pct = Math.round((count / total) * 100);
    const colorKey = name.toLowerCase().replace(/s$/, '');
    const color = CATEGORY_COLORS[colorKey] || CATEGORY_COLORS.otros;
    const nextPercent = currentPercent + pct;
    const arcLength = Number(
      ((count / total) * DONUT_CIRCUMFERENCE).toFixed(2),
    );
    const dashOffset = Number((-cumulativeArc).toFixed(2));

    gradientStops.push(`${color} ${currentPercent}% ${nextPercent}%`);
    currentPercent = nextPercent;
    cumulativeArc += arcLength;

    types.push({
      name,
      count,
      percentage: pct,
      color,
      dashArray: `${arcLength} ${DONUT_CIRCUMFERENCE}`,
      dashOffset,
    });
  }

  return { types, gradientStops };
};

export const calculateProductDistribution = async (dateRange, user, farmId) => {
  const { startDate, endDate } = dateRange;
  const farmIds = await getActiveFarmIds(user, farmId);

  if (farmIds.length === 0) {
    return {
      total: 0,
      conicGradientStyle: 'background: #e2e8f0;',
      types: [],
    };
  }

  const apps = await FarmApplication.findAll({
    where: {
      farm_id: { [Op.in]: farmIds },
      createdAt: { [Op.between]: [startDate, endDate] },
    },
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'category'],
        required: false,
      },
    ],
  });

  if (!apps || apps.length === 0) {
    return {
      total: 0,
      conicGradientStyle: 'background: #e2e8f0;',
      types: [],
    };
  }

  const counts = new Map();
  for (const item of apps) {
    const cat = normalizeCategory(item.product?.category);
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }

  const total = apps.length;
  const { types, gradientStops } = buildDonutSegments(counts, total);

  return {
    total,
    conicGradientStyle: `background: conic-gradient(${gradientStops.join(', ')});`,
    types,
  };
};

export const calculateTopPlagues = async (dateRange, user, farmId) => {
  const { startDate, endDate } = dateRange;
  const farmIds = await getActiveFarmIds(user, farmId);

  if (farmIds.length === 0) return [];

  const reports = await FarmHealthReport.findAll({
    attributes: [
      'plague_name',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ],
    where: {
      farm_id: { [Op.in]: farmIds },
      createdAt: { [Op.between]: [startDate, endDate] },
    },
    group: ['plague_name'],
    order: [[Sequelize.literal('"count"'), 'DESC']],
    limit: 5,
    raw: true,
  });

  if (!reports || reports.length === 0) {
    return [];
  }

  const maxCount = Number(reports[0]?.count) || 1;

  return reports.map((row, index) => {
    const count = Number(row.count) || 0;
    const percentage = Math.max(15, Math.round((count / maxCount) * 100));
    return {
      name: row.plague_name || 'Plaga no identificada',
      count,
      percentage,
      color: PALETTE[index % PALETTE.length],
    };
  });
};

const getAlertBadgeInfo = (count) => {
  if (count >= 3) {
    return {
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      badgeText: `${count} alertas`,
    };
  }
  if (count === 2) {
    return {
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      badgeText: `${count} alertas`,
    };
  }
  if (count === 1) {
    return {
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      badgeText: '1 alerta',
    };
  }
  return {
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
    badgeText: 'Sin alertas',
  };
};

export const calculateActiveFarms = async (dateRange, user, farmId) => {
  const { startDate, endDate } = dateRange;
  const { farmWhere } = buildFarmScope(user, farmId);

  const farms = await Farm.findAll({
    where: farmWhere,
    attributes: ['id', 'name', 'municipality', 'size_hectares'],
    limit: 10,
  });

  if (!farms || farms.length === 0) return [];

  const farmIds = farms.map((f) => f.id);
  const alertsByFarm = await FarmHealthReport.findAll({
    attributes: [
      'farm_id',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'alertsCount'],
    ],
    where: {
      farm_id: { [Op.in]: farmIds },
      severity: { [Op.in]: ['high', 'critical'] },
      createdAt: { [Op.between]: [startDate, endDate] },
    },
    group: ['farm_id'],
    raw: true,
  });

  const alertsMap = new Map();
  for (const item of alertsByFarm) {
    alertsMap.set(item.farm_id, Number(item.alertsCount) || 0);
  }

  const enriched = farms.map((f) => {
    const alertsCount = alertsMap.get(f.id) || 0;
    const badge = getAlertBadgeInfo(alertsCount);
    return {
      id: f.id,
      name: f.name,
      municipality: f.municipality || 'Sinaloa',
      sizeHectares: Number(f.size_hectares) || 0,
      alertsCount,
      alertBadgeClass: badge.badgeClass,
      alertBadgeText: badge.badgeText,
    };
  });

  return enriched.sort((a, b) => b.alertsCount - a.alertsCount).slice(0, 4);
};

const extractFarmMeta = (farm) => {
  const f = farm || {};
  const municipality = f.municipality || 'Lote';
  const hectares = f.size_hectares || 0;
  return {
    farmName: f.name || 'Predio sin nombre',
    farmDetails: `${municipality} · ${hectares} ha`,
  };
};

const extractProductMeta = (raw, product) => {
  const p = product || {};
  const category = p.category || 'Químico';
  const doseValue = raw.dose_value || '0';
  const doseUnit = raw.dose_unit || 'L/ha';

  return {
    productName: raw.product_name || p.name || 'Producto agrícola',
    category,
    categoryBadgeClass: getCategoryBadgeClass(category),
    activeIngredient: raw.active_ingredient || 'No especificado',
    doseText: `${doseValue} ${doseUnit}`,
  };
};

const extractTechnicianMeta = (technician) => {
  const t = technician || {};
  const fullName = t.full_name || 'Técnico de campo';
  return {
    technicianName: fullName,
    technicianInitials: getTechnicianInitials(fullName),
  };
};

const formatApplicationItem = (item) => {
  const raw = item.toJSON ? item.toJSON() : item;
  const { farmName, farmDetails } = extractFarmMeta(raw.farm);
  const prodMeta = extractProductMeta(raw, raw.product);
  const techMeta = extractTechnicianMeta(raw.createdBy);

  return {
    id: raw.id,
    formattedDate: formatDisplayDate(raw.applied_at || raw.createdAt),
    farmName,
    farmDetails,
    ...prodMeta,
    ...techMeta,
  };
};

export const fetchLatestApplications = async (
  dateRange,
  user,
  farmId,
  limit = 10,
) => {
  const { startDate, endDate } = dateRange;
  const { includeFarm } = buildFarmScope(user, farmId);

  const rows = await FarmApplication.findAll({
    where: {
      createdAt: { [Op.between]: [startDate, endDate] },
    },
    include: [
      includeFarm,
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'category'],
        required: false,
      },
      {
        model: User,
        as: 'createdBy',
        attributes: ['id', 'full_name', 'email'],
        required: false,
      },
    ],
    order: [
      ['applied_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit,
  });

  return rows.map(formatApplicationItem);
};

const getHealthMeta = (raw) => ({
  date: formatDisplayDate(raw.observed_at || raw.createdAt),
  farm: raw.farm?.name || 'Predio',
  plague: raw.plague_name || 'Plaga',
});

const getHealthStatus = (raw) => ({
  severity: raw.severity || 'low',
  status: raw.status || 'open',
  description: raw.description || '',
  technician: raw.createdBy?.full_name || 'Técnico',
});

const formatHealthReportItem = (item) => {
  const raw = item.toJSON ? item.toJSON() : item;
  return {
    ...getHealthMeta(raw),
    ...getHealthStatus(raw),
  };
};

export const fetchHealthReportsForExport = async (dateRange, user, farmId) => {
  const { startDate, endDate } = dateRange;
  const { includeFarm } = buildFarmScope(user, farmId);

  const rows = await FarmHealthReport.findAll({
    where: {
      createdAt: { [Op.between]: [startDate, endDate] },
    },
    include: [
      includeFarm,
      {
        model: User,
        as: 'createdBy',
        attributes: ['id', 'full_name'],
        required: false,
      },
    ],
    order: [
      ['observed_at', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  return rows.map(formatHealthReportItem);
};

const fetchAccessibleFarmOptions = async (user, selectedFarmId) => {
  const farmWhere = getLandListWhere(user, { status: 'active' });
  const farms = await Farm.findAll({
    where: farmWhere,
    attributes: ['id', 'name', 'municipality'],
    raw: true,
  });

  return (farms || []).map((farm) => ({
    id: farm.id,
    name: farm.name,
    municipality: farm.municipality || '',
    selected: Number(farm.id) === Number(selectedFarmId),
  }));
};

export const getOperationalReportsData = async (user, query = {}) => {
  const normalizedQuery = normalizeReportQuery(query);
  const dateRange = getPeriodDateRange(normalizedQuery.period);

  const [
    kpis,
    monthlyApplications,
    productDistribution,
    topPlagues,
    activeFarms,
    latestApplications,
    farmOptions,
  ] = await Promise.all([
    calculateKpis(dateRange, user, normalizedQuery.farmId),
    calculateMonthlyApplications(
      dateRange,
      user,
      normalizedQuery.farmId,
      new Date(),
    ),
    calculateProductDistribution(dateRange, user, normalizedQuery.farmId),
    calculateTopPlagues(dateRange, user, normalizedQuery.farmId),
    calculateActiveFarms(dateRange, user, normalizedQuery.farmId),
    fetchLatestApplications(dateRange, user, normalizedQuery.farmId, 10),
    fetchAccessibleFarmOptions(user, normalizedQuery.farmId),
  ]);

  return {
    query: normalizedQuery,
    kpis,
    monthlyApplications,
    productDistribution,
    topPlagues,
    activeFarms,
    farmOptions,
    latestApplications,
    hasApplications: latestApplications.length > 0,
    hasPlagues: topPlagues.length > 0,
  };
};

const escapeCsv = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  if (/^[=+\-@]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
};

const buildHealthCsvRows = (healthRows) => {
  const header = [
    'Fecha Observada',
    'Predio',
    'Plaga / Enfermedad',
    'Severidad',
    'Estado',
    'Descripción / Síntomas',
    'Técnico Responsable',
  ];
  const rows = healthRows.map((r) => [
    r.date,
    r.farm,
    r.plague,
    r.severity,
    r.status,
    r.description,
    r.technician,
  ]);
  return [header, ...rows];
};

const buildApplicationsCsvRows = (applications) => {
  const header = [
    'Fecha Aplicación',
    'Predio',
    'Producto Comercial',
    'Categoría',
    'Ingrediente Activo',
    'Dosis',
    'Técnico Aplicador',
  ];
  const rows = applications.map((app) => [
    app.formattedDate,
    app.farmName,
    app.productName,
    app.category,
    app.activeIngredient,
    app.doseText,
    app.technicianName,
  ]);
  return [header, ...rows];
};

const resolveCsvTableRows = async (reportType, data, user) => {
  if (reportType === 'health') {
    const healthRows = await fetchHealthReportsForExport(
      getPeriodDateRange(data.query.period),
      user,
      data.query.farmId,
    );
    return buildHealthCsvRows(healthRows);
  }
  return buildApplicationsCsvRows(data.latestApplications);
};

export const generateOperationalReportCsv = async ({
  reportType,
  data,
  user,
}) => {
  const UTF8_BOM = '\uFEFF';
  const tableRows = await resolveCsvTableRows(reportType, data, user);

  const csvBody = tableRows
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');

  return UTF8_BOM + csvBody;
};
