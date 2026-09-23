import db from '../../../models/index.js';
import {
  getContextualPlaguePermissions,
  getPlaguePermissions,
} from '../../../services/plagueAuthorizationService.js';
import {
  PRIVATE_PLAGUE_PAGE_SIZE,
  buildPrivatePlaguePagination,
  normalizePrivatePlagueListQuery,
} from '../../../services/plagueListService.js';
import {
  PLAGUE_WORKFLOW_STATUSES,
  isPlagueEditable,
} from '../../../services/plagueWorkflowService.js';
import { privateLayout } from './plagueControllerUtils.js';

const { Plague, PlagueImage } = db;

const categoryOptions = [
  { value: '', text: 'Todas' },
  { value: 'Insecto', text: 'Insecto' },
  { value: 'Hongo', text: 'Hongo' },
  { value: 'Bacteria', text: 'Bacteria' },
  { value: 'Virus', text: 'Virus' },
  { value: 'Ácaro', text: 'Ácaro' },
];

const workflowOptions = [
  { value: '', text: 'Todos' },
  { value: PLAGUE_WORKFLOW_STATUSES.DRAFT, text: 'Borrador' },
  { value: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW, text: 'En revisión' },
  { value: PLAGUE_WORKFLOW_STATUSES.VERIFIED, text: 'Verificada' },
  { value: PLAGUE_WORKFLOW_STATUSES.PUBLISHED, text: 'Publicada' },
  { value: PLAGUE_WORKFLOW_STATUSES.ARCHIVED, text: 'Archivada' },
];

const buildSearchWhere = ({ search, category, workflow }, Op) => {
  const where = {};

  if (search.trim()) {
    const searchTerm = search.trim();
    where[Op.or] = [
      { name: { [Op.iLike]: `%${searchTerm}%` } },
      { scientific_name: { [Op.iLike]: `%${searchTerm}%` } },
      { region: { [Op.iLike]: `%${searchTerm}%` } },
      { symptoms: { [Op.iLike]: `%${searchTerm}%` } },
    ];

    if (/^\d+$/.test(searchTerm)) {
      const searchedId = Number(searchTerm);
      if (Number.isSafeInteger(searchedId) && searchedId > 0) {
        where[Op.or].push({ id: searchedId });
      }
    }
  }

  if (category.trim()) where.category = category;
  if (Object.values(PLAGUE_WORKFLOW_STATUSES).includes(workflow)) {
    where.workflow_status = workflow;
  }

  return where;
};

const serializePlague = (plague, currentUser) => {
  const data = plague.toJSON();
  const images = Array.isArray(data.images) ? data.images : [];
  const normalizedImages = images.map((image) => ({
    id: image.id,
    url: `/${String(image.url).replace(/^\/+/, '')}`,
    ...(image.caption ? { caption: image.caption } : {}),
    ...(image.source ? { source: image.source } : {}),
    sort_order: image.sort_order || 0,
  }));
  const recordPermissions = getContextualPlaguePermissions({
    role: currentUser.role,
    userId: currentUser.id,
    createdByUserId: data.created_by_user_id,
  });

  return {
    ...data,
    image_url: normalizedImages.length > 0 ? normalizedImages[0].url : null,
    images,
    images_json: JSON.stringify(normalizedImages),
    biological_cycle_json: JSON.stringify(data.biological_cycle || []),
    canEditRecord:
      recordPermissions.canEdit && isPlagueEditable(data.workflow_status),
  };
};

export const plaguesPrivate = async (req, res) => {
  try {
    const query = normalizePrivatePlagueListQuery(req.query);
    const { search, category, workflow } = query;
    const { Op } = db.Sequelize;
    const where = buildSearchWhere(query, Op);
    const filteredCount = await Plague.count({ where });
    const pagination = buildPrivatePlaguePagination({
      requestedPage: query.page,
      totalItems: filteredCount,
      filters: { search, category, workflow },
    });

    const plagueRecords = await Plague.findAll({
      where,
      limit: PRIVATE_PLAGUE_PAGE_SIZE,
      offset: (pagination.currentPage - 1) * PRIVATE_PLAGUE_PAGE_SIZE,
      include: [
        {
          model: PlagueImage,
          as: 'images',
          required: false,
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const currentUser = req.user;
    const permissions = getPlaguePermissions(currentUser.role);
    const plagues = plagueRecords.map((plague) =>
      serializePlague(plague, currentUser),
    );
    const [totalPlagues, activePlagues, criticalPlagues, pendingVerification] =
      await Promise.all([
        Plague.count(),
        Plague.count({
          where: { workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED },
        }),
        Plague.count({
          where: {
            risk_level: { [Op.or]: ['Crítico', 'Alto', 'critico', 'alto'] },
          },
        }),
        Plague.count({
          where: { workflow_status: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW },
        }),
      ]);

    return res.render('private/catalog/plagues', {
      layout: privateLayout,
      pageTitle: 'Gestión Fitosanitaria - Plagas',
      activePage: 'plagues',
      plagues,
      filters: { search, category, workflow },
      hasActiveFilters: Boolean(search || category || workflow),
      pagination,
      stats: {
        totalPlagues,
        activePlagues,
        criticalPlagues,
        pendingVerification,
      },
      permissions,
      isAdmin: currentUser.role === 'admin',
      isInifap: currentUser.role === 'inifap' || currentUser.role === 'admin',
      searchId: 'plague-search',
      searchPlaceholder: 'Buscar por nombre, especie o cultivo afectado...',
      searchFilters: [
        {
          id: 'filter-category',
          label: 'Categoría:',
          options: categoryOptions,
        },
        { id: 'filter-workflow', label: 'Estatus:', options: workflowOptions },
      ],
      ctaLabel: 'Añadir Plaga',
      ctaIcon: 'bug_report',
      ctaBtnId: 'btn-add-plague',
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al cargar las plagas:', error);
    return res.status(500).send('Error al cargar las plagas');
  }
};
