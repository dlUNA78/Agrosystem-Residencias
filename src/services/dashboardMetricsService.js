import db from '../models/index.js';
import { getLandListWhere } from './landAuthorizationService.js';

const {
  Plague,
  Crop,
  Product,
  ActiveIngredient,
  Supplier,
  Farm,
  FarmCrop,
  FarmHealthReport,
  AuditLog,
  User,
  Sequelize,
} = db;

const { Op } = Sequelize;

const DONUT_RADIUS = 46;
const DONUT_CIRCUMFERENCE = Number((2 * Math.PI * DONUT_RADIUS).toFixed(2));
const PALETTE = ['#1b4332', '#2d6a4f', '#40916c', '#74c69d', '#b7e4c7'];

const ACTION_LABELS = {
  create: 'registró',
  update: 'actualizó',
  delete: 'eliminó',
  export: 'exportó',
  status_change: 'cambió estado en',
  approve: 'validó',
};

const MODULE_LABELS = {
  Farms: 'Terrenos',
  farms: 'Terrenos',
  Plagues: 'Plagas',
  plagues: 'Plagas',
  Crops: 'Cultivos',
  crops: 'Cultivos',
  Products: 'Productos',
  products: 'Productos',
  ActiveIngredients: 'Ingredientes Activos',
  active_ingredients: 'Ingredientes Activos',
  Suppliers: 'Proveedores',
  suppliers: 'Proveedores',
  Reports: 'Reportes',
  reports: 'Reportes',
  Users: 'Usuarios',
  users: 'Usuarios',
};

const ADMIN_QUICK_ACTIONS = [
  {
    href: '/private/lands',
    icon: 'map-pin',
    label: 'Registrar predio',
  },
  {
    href: '/private/ingredients',
    icon: 'flask-conical',
    label: 'Ingredientes activos',
  },
  {
    href: '/private/suppliers',
    icon: 'truck',
    label: 'Proveedores',
  },
  {
    href: '/private/reports',
    icon: 'bar-chart-3',
    label: 'Resumen ejecutivo PDF',
  },
  {
    href: '/private/audit',
    icon: 'shield-check',
    label: 'Bitácora de auditoría',
  },
  {
    href: '/private/users',
    icon: 'key',
    label: 'Usuarios y códigos INIFAP',
  },
];

const INIFAP_QUICK_ACTIONS = [
  {
    href: '/private/lands',
    icon: 'map-pin',
    label: 'Predios monitoreados',
  },
  {
    href: '/private/catalog/plagues',
    icon: 'bug',
    label: 'Catálogo de plagas',
  },
  {
    href: '/private/crops',
    icon: 'sprout',
    label: 'Cultivos validados',
  },
  {
    href: '/private/products',
    icon: 'package',
    label: 'Insumos fitosanitarios',
  },
  {
    href: '/private/ingredients',
    icon: 'flask-conical',
    label: 'Ingredientes activos',
  },
  {
    href: '/private/reports',
    icon: 'bar-chart-3',
    label: 'Reportes operativos',
  },
];

const countSafely = async (model, where) => {
  if (typeof model?.count !== 'function') {
    return 0;
  }
  const value = where ? await model.count({ where }) : await model.count();
  return Number(value) || 0;
};

/**
 * Calcula conteo de fichas de catálogo pendientes de validación técnica
 */
export const getPendingValidationsMetrics = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [plaguesPending, cropsPending, productsPending, todayNewCount] =
    await Promise.all([
      Plague.count({ where: { workflow_status: 'in_review' } }),
      Crop.count({ where: { workflow_status: 'in_review' } }),
      Product.count({ where: { workflow_status: 'in_review' } }),
      Plague.count({
        where: {
          workflow_status: 'in_review',
          updatedAt: { [Op.gte]: todayStart },
        },
      }),
    ]);

  const total = plaguesPending + cropsPending + productsPending;

  return {
    total,
    plaguesPending,
    cropsPending,
    productsPending,
    todayNewCount,
  };
};

/**
 * Conteo de alertas fitosanitarias críticas abiertas
 */
export const getCriticalAlertsMetrics = async (user) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const where = {
    severity: 'high',
    status: 'open',
    createdAt: { [Op.gte]: thirtyDaysAgo },
  };

  const include = [];
  if (user?.role !== 'admin' && user?.id) {
    include.push({
      model: Farm,
      as: 'farm',
      where: { user_id: user.id },
      required: true,
    });
  }

  const criticalCount = await FarmHealthReport.count({
    where,
    include: include.length > 0 ? include : undefined,
  });

  const latestAlert = await FarmHealthReport.findOne({
    where,
    include: [
      {
        model: Farm,
        as: 'farm',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  return {
    criticalCount,
    latestAlert: latestAlert ? latestAlert.toJSON() : null,
  };
};

/**
 * Calcula hectáreas activas monitoreadas y predios activos
 */
export const getMonitoredLandMetrics = async (user) => {
  const farmWhere = getLandListWhere(user, { status: 'active' });

  const [totalFarms, hectaresSum, activeCyclesCount] = await Promise.all([
    Farm.count({ where: farmWhere }),
    Farm.sum('size_hectares', { where: farmWhere }),
    FarmCrop.count({
      where: { is_active: true },
      include: [
        {
          model: Farm,
          as: 'farm',
          where: farmWhere,
          required: true,
        },
      ],
    }),
  ]);

  const numericHectares = Number(hectaresSum) || 0;
  const formattedHectares = numericHectares.toLocaleString('es-MX', {
    maximumFractionDigits: 1,
  });

  return {
    totalFarms,
    activeCyclesCount,
    hectares: numericHectares,
    formattedHectares,
  };
};

/**
 * Top 5 de plagas con mayor número de reportes en los últimos 30 días
 */
export const getTopPlaguesOfMonth = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const reports = await FarmHealthReport.findAll({
    attributes: [
      'plague_name',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'reportCount'],
    ],
    where: {
      createdAt: { [Op.gte]: thirtyDaysAgo },
    },
    group: ['plague_name'],
    order: [[Sequelize.literal('"reportCount"'), 'DESC']],
    limit: 5,
    raw: true,
  });

  if (!reports || reports.length === 0) {
    return [];
  }

  const maxCount = Number(reports[0]?.reportCount) || 1;
  const barColors = ['#1b4332', '#2d6a4f', '#40916c', '#74c69d', '#b7e4c7'];

  return reports.map((item, index) => {
    const count = Number(item.reportCount) || 0;
    const percentage = Math.max(15, Math.round((count / maxCount) * 100));
    return {
      index: String(index + 1).padStart(2, '0'),
      name: item.plague_name || 'Plaga no identificada',
      count,
      percentage,
      color: barColors[index % barColors.length],
    };
  });
};

const extractCropAggregates = (activeCrops) => {
  const totalsByCrop = new Map();
  let totalHectares = 0;

  for (const item of activeCrops) {
    const cropName = item.crop?.name ?? item.crop?.common_name ?? 'Sin nombre';
    const hectares = Number(item.farm?.size_hectares) || 0;
    totalHectares += hectares;

    const current = totalsByCrop.get(cropName) || { count: 0, hectares: 0 };
    current.count += 1;
    current.hectares += hectares;
    totalsByCrop.set(cropName, current);
  }

  return { totalsByCrop, totalHectares };
};

const buildCropSegments = (sorted, totalCount) => {
  let currentPercent = 0;
  let cumulativeArc = 0;
  const gradientStops = [];

  const crops = sorted.map((item, idx) => {
    const pct = Math.round((item.count / totalCount) * 100);
    const color = PALETTE[idx % PALETTE.length];
    const nextPercent = currentPercent + pct;
    gradientStops.push(`${color} ${currentPercent}% ${nextPercent}%`);
    currentPercent = nextPercent;

    const arcLength = Number(((pct / 100) * DONUT_CIRCUMFERENCE).toFixed(2));
    const dashArray = `${arcLength} ${DONUT_CIRCUMFERENCE}`;
    const dashOffset = Number((-cumulativeArc).toFixed(2));
    cumulativeArc += arcLength;

    return {
      name: item.name,
      count: item.count,
      hectares: Math.round(item.hectares * 10) / 10,
      percentage: pct,
      color,
      dashArray,
      dashOffset,
    };
  });

  return { crops, gradientStops };
};

const formatHectaresLabel = (totalHectares) => {
  if (totalHectares >= 1000) {
    return `${(totalHectares / 1000).toFixed(1)}k`;
  }
  return Math.round(totalHectares).toString();
};

/**
 * Distribución de cultivos con ciclos activos (con segmentos SVG vectoriales)
 */
export const getActiveCropDistribution = async (user) => {
  const farmWhere = getLandListWhere(user, { status: 'active' });

  const activeCrops = await FarmCrop.findAll({
    where: { is_active: true },
    include: [
      {
        model: Crop,
        as: 'crop',
        attributes: ['id', 'name', 'common_name'],
        required: true,
      },
      {
        model: Farm,
        as: 'farm',
        where: farmWhere,
        attributes: ['id', 'size_hectares'],
        required: true,
      },
    ],
  });

  if (!activeCrops || activeCrops.length === 0) {
    return {
      hasData: false,
      totalCycles: 0,
      totalHectaresText: '0',
      conicGradientStyle: 'background: #e2e8f0;',
      crops: [],
    };
  }

  const { totalsByCrop, totalHectares } = extractCropAggregates(activeCrops);
  const sorted = Array.from(totalsByCrop.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      hectares: data.hectares,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const totalCount = sorted.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const { crops, gradientStops } = buildCropSegments(sorted, totalCount);

  return {
    hasData: true,
    totalCycles: activeCrops.length,
    totalHectaresText: formatHectaresLabel(totalHectares),
    conicGradientStyle: `background: conic-gradient(${gradientStops.join(', ')});`,
    crops,
  };
};

/**
 * Obtiene resumen del ecosistema de catálogos, ingredientes activos y proveedores
 */
export const getCatalogEcosystemMetrics = async () => {
  const [
    totalIngredients,
    activeIngredients,
    totalSuppliers,
    activeSuppliers,
    publishedPlagues,
    publishedCrops,
    publishedProducts,
  ] = await Promise.all([
    countSafely(ActiveIngredient),
    countSafely(ActiveIngredient, { status: 'active' }),
    countSafely(Supplier),
    countSafely(Supplier, { status: 'active' }),
    countSafely(Plague, { workflow_status: 'published' }),
    countSafely(Crop, { workflow_status: 'published' }),
    countSafely(Product, { workflow_status: 'published' }),
  ]);

  return {
    totalIngredients,
    activeIngredients,
    totalSuppliers,
    activeSuppliers,
    publishedPlagues,
    publishedCrops,
    publishedProducts,
    publishedTotal: publishedPlagues + publishedCrops + publishedProducts,
  };
};

const getRelativeTime = (date) => {
  if (!date) return 'Reciente';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Hace un momento';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
};

const getUserInitials = (fullName) => {
  if (!fullName) return 'AG';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
};

const resolveEntityName = (values) =>
  values.name || values.full_name || values.plague_name || '';

const resolveActionLabel = (rawAction) => {
  if (!rawAction) return 'modificó';
  return ACTION_LABELS[String(rawAction).toLowerCase()] || rawAction;
};

const resolveModuleLabel = (rawTableName) => {
  const tableName = rawTableName || 'Sistema';
  return {
    tableName,
    moduleLabel: MODULE_LABELS[tableName] || tableName,
  };
};

const formatAuditItem = (log) => {
  const raw = log.toJSON();
  const actor = raw.user || {};
  const values = raw.new_values || raw.old_values || {};
  const { tableName, moduleLabel } = resolveModuleLabel(raw.table_name);

  return {
    id: raw.id,
    userName: actor.full_name || 'Usuario del sistema',
    initials: getUserInitials(actor.full_name),
    action: raw.action,
    actionLabel: resolveActionLabel(raw.action),
    tableName,
    moduleLabel,
    entityName: resolveEntityName(values),
    relativeTime: getRelativeTime(raw.createdAt || raw.created_at),
  };
};

/**
 * Obtiene los últimos eventos de auditoría para el feed del dashboard
 */
export const getRecentAuditActivity = async (limit = 5) => {
  const logs = await AuditLog.findAll({
    limit,
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'email', 'role'],
        required: false,
      },
    ],
  });

  return logs.map(formatAuditItem);
};

export const buildQuickActions = (user) =>
  user?.role === 'admin' ? ADMIN_QUICK_ACTIONS : INIFAP_QUICK_ACTIONS;

/**
 * Consolida todas las métricas para el controlador del Dashboard
 */
export const getDashboardSummary = async (user) => {
  const [
    validations,
    alerts,
    land,
    topPlagues,
    cropDistribution,
    recentActivity,
    ecosystem,
  ] = await Promise.all([
    getPendingValidationsMetrics(),
    getCriticalAlertsMetrics(user),
    getMonitoredLandMetrics(user),
    getTopPlaguesOfMonth(),
    getActiveCropDistribution(user),
    getRecentAuditActivity(5),
    getCatalogEcosystemMetrics(),
  ]);

  return {
    validations,
    alerts,
    land,
    topPlagues,
    cropDistribution,
    recentActivity,
    ecosystem,
    quickActions: buildQuickActions(user),
    isAdmin: user?.role === 'admin',
    isInifap: user?.role === 'inifap',
  };
};
