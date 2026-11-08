import path from 'node:path';
import { fileURLToPath } from 'node:url';

import db from '../../../models/index.js';
import {
  getContextualCropPermissions,
  getCropPermissions,
} from '../../../services/cropAuthorizationService.js';
import {
  CROP_CATEGORY_OPTIONS,
  PRIVATE_CROP_PAGE_SIZE,
  buildPrivateCropPagination,
  normalizePrivateCropListQuery,
} from '../../../services/cropListService.js';
import {
  CROP_WORKFLOW_STATUSES,
  isCropEditable,
} from '../../../services/cropWorkflowService.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);
const { Crop, CropImage, User } = db;

const normalizeImageUrl = (value) =>
  value ? `/${String(value).replace(/^\/+/, '')}` : null;

const buildCropListIncludes = () => {
  const includes = [
    {
      model: CropImage,
      as: 'images',
      required: false,
      separate: true,
      order: [
        ['is_primary', 'DESC'],
        ['display_order', 'ASC'],
      ],
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
  return includes;
};

const buildListItem = (record, user) => {
  const crop = record.toJSON();
  const images = Array.isArray(crop.images) ? crop.images : [];
  const primaryImage =
    images.find((image) => image.is_primary === true) || images[0];
  const permissions = getContextualCropPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: crop.created_by_user_id,
  });

  return {
    ...crop,
    image_url: normalizeImageUrl(primaryImage?.image_url),
    imageCount: images.length,
    authorName: crop.createdBy?.full_name || 'Sistema INIFAP',
    authorRole: crop.createdBy?.role || 'inifap',
    canEditRecord: permissions.canEdit && isCropEditable(crop.workflow_status),
    canDeleteRecord: permissions.canDelete,
  };
};

export const cropsPrivate = async (req, res) => {
  try {
    const query = normalizePrivateCropListQuery(req.query);
    const permissions = getCropPermissions(req.user.role);
    const { Op } = db.Sequelize;
    const where = {};

    if (query.search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { scientific_name: { [Op.iLike]: `%${query.search}%` } },
        { category: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    if (query.category) where.category = query.category;
    if (query.workflow) where.workflow_status = query.workflow;

    const totalItems = await Crop.count({ where });
    const pagination = buildPrivateCropPagination({
      requestedPage: query.page,
      totalItems,
      filters: query,
    });
    const records = await Crop.findAll({
      where,
      limit: PRIVATE_CROP_PAGE_SIZE,
      offset: (pagination.currentPage - 1) * PRIVATE_CROP_PAGE_SIZE,
      include: buildCropListIncludes(),
      order: [['createdAt', 'DESC']],
    });
    const [published, inReview, changesRequested] = await Promise.all([
      Crop.count({
        where: { workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED },
      }),
      Crop.count({
        where: { workflow_status: CROP_WORKFLOW_STATUSES.IN_REVIEW },
      }),
      Crop.count({
        where: { workflow_status: CROP_WORKFLOW_STATUSES.CHANGES_REQUESTED },
      }),
    ]);

    return res.render('private/catalog/crops', {
      layout: privateLayout,
      pageTitle: 'Gestión agronómica - Cultivos',
      activePage: 'crops',
      isAdmin: req.user?.role === 'admin',
      isInifap: req.user?.role === 'inifap',
      crops: records.map((record) => buildListItem(record, req.user)),
      filters: query,
      pagination,
      permissions,
      stats: { total: totalItems, published, inReview, changesRequested },
      hasActiveFilters: Boolean(
        query.search || query.category || query.workflow,
      ),
      searchId: 'crop-search',
      searchValue: query.search,
      searchPlaceholder: 'Buscar por nombre, especie o categoría...',
      searchFilters: [
        {
          id: 'filter-type',
          param: 'category',
          label: 'Tipo:',
          options: CROP_CATEGORY_OPTIONS.map((option) => ({
            ...option,
            selected: option.value === query.category,
          })),
        },
        {
          id: 'filter-workflow',
          param: 'workflow',
          label: 'Estatus:',
          options: [
            { value: 'draft', text: 'Borrador' },
            { value: 'in_review', text: 'En revisión' },
            { value: 'changes_requested', text: 'Cambios solicitados' },
            { value: 'verified', text: 'Verificado' },
            { value: 'published', text: 'Publicado' },
            { value: 'archived', text: 'Archivado' },
          ].map((option) => ({
            ...option,
            selected: option.value === query.workflow,
          })),
        },
      ],
      ctaLabel: permissions.canCreate ? 'Añadir Cultivo' : null,
      ctaIcon: 'agriculture',
      ctaBtnId: 'btn-add-crop',
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al cargar los cultivos:', error);
    return res.status(500).send('Error al cargar los cultivos');
  }
};
