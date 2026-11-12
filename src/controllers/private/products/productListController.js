import db from '../../../models/index.js';
import {
  getContextualProductPermissions,
  getProductPermissions,
} from '../../../services/productAuthorizationService.js';
import {
  PRIVATE_PRODUCT_PAGE_SIZE,
  buildPrivateProductPagination,
  normalizePrivateProductListQuery,
} from '../../../services/productListService.js';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_HAZARD_BANDS,
  normalizeHazardCategory,
  resolveProductHazardTheme,
} from '../../../services/productValidationService.js';
import {
  PRODUCT_WORKFLOW_STATUSES,
  isProductEditable,
} from '../../../services/productWorkflowService.js';
import {
  loadFormCatalogOptions,
  normalizeImageUrl,
  privateLayout,
} from './productControllerUtils.js';

const { Product, ProductImage, User } = db;

const productImagesInclude = {
  model: ProductImage,
  as: 'images',
  required: false,
  separate: true,
  order: [
    ['is_primary', 'DESC'],
    ['display_order', 'ASC'],
  ],
};

const buildProductListIncludes = () => {
  const includes = [productImagesInclude];
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

const formatSafetyShort = (days) => {
  if (days === null || days === undefined || days === '') return null;
  const num = Number(days);
  if (!Number.isInteger(num) || num < 0) return null;
  return num === 0 ? '0 días (S/L)' : `${num} días`;
};

const normalizeProductImages = (rawImages) =>
  (rawImages || []).map((image) => ({
    ...image,
    image_url: normalizeImageUrl(image.image_url),
  }));

const resolvePrimaryImageUrl = (images) => {
  const primary = images.find((image) => image.is_primary) || images[0];
  return primary?.image_url || '/images/products/default.png';
};

const isControlledProductStage = (status) =>
  status === PRODUCT_WORKFLOW_STATUSES.VERIFIED ||
  status === PRODUCT_WORKFLOW_STATUSES.PUBLISHED;

const resolveProductEditFlags = (permissions, status, role) => {
  const isDraftEditable = permissions.canEdit && isProductEditable(status);
  const canControlledEdit =
    ['admin', 'inifap'].includes(role) && isControlledProductStage(status);
  return {
    canEditRecord: isDraftEditable || canControlledEdit,
    isControlledEdit: !isDraftEditable && canControlledEdit,
  };
};

const buildProductListItem = (record, user) => {
  const product = record.toJSON();
  const images = normalizeProductImages(product.images);
  const permissions = getContextualProductPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: product.created_by_user_id,
  });
  const editFlags = resolveProductEditFlags(
    permissions,
    product.workflow_status,
    user.role,
  );
  const expirationDateFormatted = product.expiration_date
    ?.toISOString?.()
    .slice(0, 10);

  return {
    ...product,
    hazard_category:
      normalizeHazardCategory(product.hazard_category) ||
      product.hazard_category,
    hazardTheme: resolveProductHazardTheme(product.hazard_category),
    safetyShort: formatSafetyShort(product.safety_interval_days),
    images,
    imageCount: images.length,
    image_url: resolvePrimaryImageUrl(images),
    expirationDateFormatted,
    expiration_date_formatted: expirationDateFormatted,
    authorName: product.createdBy?.full_name || 'Sistema INIFAP',
    authorRole: product.createdBy?.role || 'inifap',
    ...editFlags,
    canDeleteRecord:
      permissions.canDelete &&
      product.workflow_status === PRODUCT_WORKFLOW_STATUSES.DRAFT,
    permissions,
  };
};

const buildPrivateWhere = (Op, query) => {
  const where = {};
  if (query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { active_ingredient: { [Op.iLike]: `%${query.search}%` } },
      { manufacturer: { [Op.iLike]: `%${query.search}%` } },
      { registration_code: { [Op.iLike]: `%${query.search}%` } },
    ];
  }
  if (query.category) where.category = query.category;
  if (query.workflow) where.workflow_status = query.workflow;
  if (query.hazard) where.hazard_category = query.hazard;
  return where;
};

const buildSearchFilters = (query) => [
  {
    id: 'filter-category',
    param: 'category',
    label: 'Categoría:',
    options: PRODUCT_CATEGORIES.map((value) => ({
      value,
      text: value,
      selected: value === query.category,
    })),
  },
  {
    id: 'filter-hazard',
    param: 'hazard',
    label: 'Banda NOM:',
    options: PRODUCT_HAZARD_BANDS.map((band) => ({
      value: band.code,
      text: band.shortLabel,
      selected: band.value === query.hazard,
    })),
  },
];

export const productsPrivate = async (req, res) => {
  try {
    const query = normalizePrivateProductListQuery(req.query);
    const permissions = getProductPermissions(req.user.role);
    const where = buildPrivateWhere(db.Sequelize.Op, query);
    const totalItems = await Product.count({ where });
    const pagination = buildPrivateProductPagination({
      requestedPage: query.page,
      totalItems,
      filters: query,
    });

    const now = new Date();
    const expiryLimit = new Date(now);
    expiryLimit.setDate(expiryLimit.getDate() + 60);

    const [
      records,
      totalCatalog,
      published,
      inReview,
      changesRequested,
      expiringRecords,
      catalogOptions,
    ] = await Promise.all([
      Product.findAll({
        where,
        limit: PRIVATE_PRODUCT_PAGE_SIZE,
        offset: (pagination.currentPage - 1) * PRIVATE_PRODUCT_PAGE_SIZE,
        include: buildProductListIncludes(),
        order: [['createdAt', 'DESC']],
      }),
      Product.count(),
      Product.count({
        where: { workflow_status: PRODUCT_WORKFLOW_STATUSES.PUBLISHED },
      }),
      Product.count({
        where: { workflow_status: PRODUCT_WORKFLOW_STATUSES.IN_REVIEW },
      }),
      Product.count({
        where: {
          workflow_status: PRODUCT_WORKFLOW_STATUSES.CHANGES_REQUESTED,
        },
      }),
      Product.findAll({
        where: {
          expiration_date: {
            [db.Sequelize.Op.between]: [now, expiryLimit],
          },
        },
        include: [productImagesInclude],
        order: [['expiration_date', 'ASC']],
      }),
      loadFormCatalogOptions(),
    ]);

    return res.render('private/catalog/products', {
      layout: privateLayout,
      pageTitle: 'Gestión de Productos Agroquímicos',
      activePage: 'products',
      isAdmin: req.user?.role === 'admin',
      isInifap: req.user?.role === 'inifap',
      products: records.map((record) => buildProductListItem(record, req.user)),
      permissions,
      filters: query,
      pagination,
      hasActiveFilters: Boolean(
        query.search || query.category || query.workflow || query.hazard,
      ),
      stats: {
        total: totalCatalog,
        published,
        inReview,
        changesRequested,
      },
      expiringSoon: expiringRecords.length,
      expiringProducts: expiringRecords.map((record) =>
        buildProductListItem(record, req.user),
      ),
      relationOptions: {
        crops: catalogOptions.crops,
        plagues: catalogOptions.plagues,
      },
      activeIngredients: catalogOptions.ingredients,
      suppliers: catalogOptions.suppliers || [],
      productCategories: PRODUCT_CATEGORIES,
      hazardCategories: PRODUCT_HAZARD_BANDS,
      searchFilters: buildSearchFilters(query),
    });
  } catch (error) {
    console.error('Error al listar productos en panel privado:', error);
    return res.status(500).send('Error interno al cargar los productos.');
  }
};
