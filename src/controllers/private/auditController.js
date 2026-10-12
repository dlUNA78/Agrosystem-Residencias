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

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { AuditLog, User, Sequelize } = db;

export const auditPrivate = async (req, res) => {
  try {
    const query = normalizeAuditQuery(req.query);
    const where = buildAuditWhere(Sequelize, query);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, result] = await Promise.all([
      AuditLog.count({
        where: {
          createdAt: {
            [Sequelize.Op.gte]: todayStart,
          },
        },
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
        limit: query.format === 'csv' ? 1000 : query.limit,
        offset: query.format === 'csv' ? 0 : (query.page - 1) * query.limit,
      }),
    ]);

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

    const totalPages = Math.ceil(result.count / query.limit) || 1;
    const startRecord =
      result.count > 0 ? (query.page - 1) * query.limit + 1 : 0;
    const endRecord = Math.min(query.page * query.limit, result.count);

    return res.render('private/admin/audit', {
      layout: privateLayout,
      pageTitle: 'Auditoría',
      activePage: 'audit',
      auditLogs: serializedLogs,
      todayActionsCount: todayCount,
      totalCount: result.count,
      startRecord,
      endRecord,
      currentPage: query.page,
      totalPages,
      hasMultiplePages: totalPages > 1,
      hasPrevPage: query.page > 1,
      hasNextPage: query.page < totalPages,
      prevPage: query.page - 1,
      nextPage: query.page + 1,
      searchId: 'audit-search',
      searchValue: query.search,
      searchPlaceholder: 'Buscar por usuario, acción, módulo o correo...',
      searchFilters: [
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
      ],
      ctaLabel: 'Exportar Log',
      ctaIcon: 'download',
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
      totalCount: 0,
      startRecord: 0,
      endRecord: 0,
      currentPage: 1,
      totalPages: 1,
      hasMultiplePages: false,
      hasPrevPage: false,
      hasNextPage: false,
      error: 'Ocurrió un error al cargar los registros de auditoría.',
    });
  }
};
