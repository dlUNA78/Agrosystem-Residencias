import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../models/index.js';
import {
  normalizeAuditQuery,
  buildAuditWhere,
  serializeAuditLog,
  generateAuditCsv,
} from '../../services/auditQueryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { AuditLog, User, Sequelize } = db;

const FILTER_PARAM_KEYS = ['search', 'module', 'action', 'dateFrom', 'dateTo'];

const buildAuditFilterSuffix = (query) => {
  const params = new URLSearchParams();
  FILTER_PARAM_KEYS.forEach((key) => {
    if (query[key]) params.set(key, query[key]);
  });
  const str = params.toString();
  return str ? `&${str}` : '';
};

const hasAnyAuditFilter = (query) =>
  FILTER_PARAM_KEYS.some((key) => Boolean(query[key]));

const buildAuditSearchFilters = (query) => [
  {
    id: 'filter-module',
    param: 'module',
    label: 'Módulo: Todos',
    options: [
      { value: 'plagas', text: 'Plagas' },
      { value: 'cultivos', text: 'Cultivos' },
      { value: 'productos', text: 'Productos' },
      { value: 'terrenos', text: 'Terrenos' },
      { value: 'usuarios', text: 'Usuarios' },
      { value: 'proveedores', text: 'Proveedores' },
      { value: 'ingredientes', text: 'Ingredientes' },
    ].map((opt) => ({
      ...opt,
      selected: opt.value === query.module,
    })),
  },
  {
    id: 'filter-action',
    param: 'action',
    label: 'Acción: Todas',
    options: [
      { value: 'crear', text: 'Creación / Registro' },
      { value: 'editar', text: 'Edición / Avance' },
      { value: 'aprobar', text: 'Revisión / Publicación' },
      { value: 'archivar', text: 'Archivado' },
      { value: 'restaurar', text: 'Restauración' },
      { value: 'eliminar', text: 'Eliminación' },
    ].map((opt) => ({
      ...opt,
      selected: opt.value === query.action,
    })),
  },
];

const buildPaginationState = (count, page, limit) => {
  const totalPages = Math.ceil(count / limit) || 1;
  return {
    totalCount: count,
    startRecord: count > 0 ? (page - 1) * limit + 1 : 0,
    endRecord: Math.min(page * limit, count),
    currentPage: page,
    totalPages,
    hasMultiplePages: totalPages > 1,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1,
  };
};

const fetchAuditRecords = async (where, query) => {
  const isCsv = query.format === 'csv';
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return Promise.all([
    AuditLog.count({
      where: { createdAt: { [Sequelize.Op.gte]: todayStart } },
    }),
    AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'email', 'role'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: isCsv ? 1000 : query.limit,
      offset: isCsv ? 0 : (query.page - 1) * query.limit,
      subQuery: false,
      distinct: true,
    }),
  ]);
};

export const auditPrivate = async (req, res) => {
  try {
    const query = normalizeAuditQuery(req.query);
    const where = buildAuditWhere(Sequelize, query);
    const [todayCount, result] = await fetchAuditRecords(where, query);
    const serializedLogs = result.rows.map(serializeAuditLog);

    if (query.format === 'csv') {
      const csvData = generateAuditCsv(serializedLogs);
      const filename = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      return res.send(csvData);
    }

    return res.render('private/admin/audit', {
      layout: privateLayout,
      pageTitle: 'Auditoría',
      activePage: 'audit',
      auditLogs: serializedLogs,
      todayActionsCount: todayCount,
      ...buildPaginationState(result.count, query.page, query.limit),
      query,
      filterSuffix: buildAuditFilterSuffix(query),
      hasActiveFilters: hasAnyAuditFilter(query),
      clearUrl: '/private/audit',
      searchId: 'audit-search',
      searchValue: query.search,
      searchPlaceholder: 'Buscar por usuario, acción, módulo o correo...',
      searchFilters: buildAuditSearchFilters(query),
      ctaLabel: 'Exportar CSV',
      ctaIcon: 'download',
      ctaLucideIcon: 'download',
      ctaBtnId: 'btn-export-audit',
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al consultar logs de auditoría:', error);
    return res.status(500).render('private/admin/audit', {
      layout: privateLayout,
      pageTitle: 'Auditoría',
      activePage: 'audit',
      auditLogs: [],
      todayActionsCount: 0,
      ...buildPaginationState(0, 1, 15),
      error: 'Ocurrió un error al cargar los registros de auditoría.',
    });
  }
};
