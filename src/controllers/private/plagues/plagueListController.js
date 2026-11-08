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

const { Crop, Plague, PlagueImage, Product, User } = db;

const loadPlagueFormRelationOptions = async () => {
  const [crops, products] = await Promise.all([
    Crop?.findAll
      ? Crop.findAll({
          where: { status: 'aprobado', workflow_status: 'published' },
          attributes: ['id', 'name', 'scientific_name', 'category'],
          order: [['name', 'ASC']],
          raw: true,
        })
      : [],
    Product?.findAll
      ? Product.findAll({
          where: { status: true, workflow_status: 'published' },
          attributes: ['id', 'name', 'active_ingredient', 'category'],
          order: [['name', 'ASC']],
          raw: true,
        })
      : [],
  ]);
  return { crops, products };
};

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

const normalizeRecordImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images.map((image) => ({
    id: image.id,
    url: `/${String(image.url).replace(/^\/+/, '')}`,
    ...(image.caption ? { caption: image.caption } : {}),
    ...(image.source ? { source: image.source } : {}),
    sort_order: image.sort_order || 0,
  }));
};

const countBiologicalStages = (rawCycle) => {
  if (!rawCycle) return 0;
  let cycle = rawCycle;
  if (typeof cycle === 'string') {
    try {
      cycle = JSON.parse(cycle);
    } catch {
      return cycle.split(/\r?\n/).filter((s) => s.trim()).length;
    }
  }
  if (Array.isArray(cycle)) return cycle.length;
  if (typeof cycle === 'object') return Object.keys(cycle).length;
  return 0;
};

const isControlledPlagueStage = (status) =>
  status === PLAGUE_WORKFLOW_STATUSES.VERIFIED ||
  status === PLAGUE_WORKFLOW_STATUSES.PUBLISHED;

const resolvePlagueEditFlags = (permissions, status, role) => {
  const isDraftEditable = permissions.canEdit && isPlagueEditable(status);
  const canControlledEdit =
    ['admin', 'inifap'].includes(role) && isControlledPlagueStage(status);
  return {
    canEditRecord: isDraftEditable || canControlledEdit,
    isControlledEdit: !isDraftEditable && canControlledEdit,
  };
};

const extractRelationIdsJson = (records) =>
  JSON.stringify(Array.isArray(records) ? records.map((item) => item.id) : []);

const serializePlague = (plague, currentUser) => {
  const data = plague.toJSON();
  const images = Array.isArray(data.images) ? data.images : [];
  const normalizedImages = normalizeRecordImages(images);
  const recordPermissions = getContextualPlaguePermissions({
    role: currentUser.role,
    userId: currentUser.id,
    createdByUserId: data.created_by_user_id,
  });
  const editFlags = resolvePlagueEditFlags(
    recordPermissions,
    data.workflow_status,
    currentUser.role,
  );

  return {
    ...data,
    image_url: normalizedImages.length > 0 ? normalizedImages[0].url : null,
    images,
    imageCount: normalizedImages.length,
    stageCount: countBiologicalStages(data.biological_cycle),
    hasMip: Boolean(data.control_methods || data.biological_control),
    images_json: JSON.stringify(normalizedImages),
    biological_cycle_json: JSON.stringify(data.biological_cycle || []),
    crop_ids_json: extractRelationIdsJson(data.crops),
    product_ids_json: extractRelationIdsJson(data.products),
    authorName: data.createdBy?.full_name || 'Sistema INIFAP',
    authorRole: data.createdBy?.role || 'inifap',
    ...editFlags,
  };
};

const buildPlagueListIncludes = () => {
  const includes = [
    {
      model: PlagueImage,
      as: 'images',
      required: false,
      separate: true,
      order: [['sort_order', 'ASC']],
    },
  ];
  if (User) {
    includes.push({
      model: User,
      as: 'createdBy',
      attributes: ['id', 'full_name', 'role'],
      required: false,
    });
  }
  if (Crop?.findAll) {
    includes.push({
      model: Crop,
      as: 'crops',
      attributes: ['id'],
      through: { attributes: [] },
      required: false,
    });
  }
  if (Product?.findAll) {
    includes.push({
      model: Product,
      as: 'products',
      attributes: ['id'],
      through: { attributes: [] },
      required: false,
    });
  }
  return includes;
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
      include: buildPlagueListIncludes(),
      order: [['createdAt', 'DESC']],
    });

    const currentUser = req.user;
    const permissions = getPlaguePermissions(currentUser.role);
    const plagues = plagueRecords.map((plague) =>
      serializePlague(plague, currentUser),
    );
    const [
      totalPlagues,
      activePlagues,
      criticalPlagues,
      pendingVerification,
      relationOptions,
    ] = await Promise.all([
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
      loadPlagueFormRelationOptions(),
    ]);

    return res.render('private/catalog/plagues', {
      layout: privateLayout,
      pageTitle: 'Gestión Fitosanitaria - Plagas',
      activePage: 'plagues',
      plagues,
      relationOptions,
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
