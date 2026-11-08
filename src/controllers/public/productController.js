import db from '../../models/index.js';
import { CROP_WORKFLOW_STATUSES } from '../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../services/plagueWorkflowService.js';
import { buildProductDetailView } from '../../services/productDetailService.js';
import { sendProductHdsPdfResponse } from '../../services/productHdsPdfService.js';
import { sendProductPdfResponse } from '../../services/productPdfService.js';
import {
  buildPublicProductCard,
  buildPublicProductPageUrl,
  buildPublishedProductWhere,
  normalizePublicProductQuery,
  parsePublicProductId,
} from '../../services/productPublicQueryService.js';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_HAZARD_BANDS,
} from '../../services/productValidationService.js';

const { Crop, CropImage, Plague, PlagueImage, Product, ProductImage, User } =
  db;

const productImageInclude = {
  model: ProductImage,
  as: 'images',
  required: false,
  separate: true,
  order: [
    ['is_primary', 'DESC'],
    ['display_order', 'ASC'],
  ],
};

const buildCatalogRelationIncludes = (query) => [
  productImageInclude,
  {
    model: Crop,
    as: 'crops',
    attributes: ['id', 'name'],
    through: { attributes: [] },
    required: Boolean(query.cropId),
    where: query.cropId
      ? {
          id: query.cropId,
          status: 'aprobado',
          workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
        }
      : {
          status: 'aprobado',
          workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
        },
  },
  {
    model: Plague,
    as: 'plagues',
    attributes: ['id', 'name'],
    through: { attributes: [] },
    required: Boolean(query.plagueId),
    where: query.plagueId
      ? {
          id: query.plagueId,
          status: true,
          workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        }
      : {
          status: true,
          workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        },
  },
];

const queryPublishedProducts = async (query) => {
  const where = buildPublishedProductWhere(db.Sequelize.Op, query);
  const offset = (query.page - 1) * query.limit;
  return Product.findAndCountAll({
    where,
    include: buildCatalogRelationIncludes(query),
    order: [['name', 'ASC']],
    limit: query.limit,
    offset,
    distinct: true,
  });
};

const buildPublicPagination = (count, query) => {
  const totalPages = Math.max(1, Math.ceil(count / query.limit));
  const currentPage = Math.min(Math.max(1, query.page), totalPages);
  const pages = Array.from({ length: totalPages }, (_, index) => {
    const number = index + 1;
    return {
      number,
      isCurrent: number === currentPage,
      url: buildPublicProductPageUrl(number, query),
    };
  });

  return {
    currentPage,
    totalPages,
    hasMultiplePages: totalPages > 1,
    hasPrevPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
    prevUrl: buildPublicProductPageUrl(Math.max(1, currentPage - 1), query),
    nextUrl: buildPublicProductPageUrl(
      Math.min(totalPages, currentPage + 1),
      query,
    ),
    pages,
  };
};

const loadPublicFilterCatalogs = () =>
  Promise.all([
    Crop.findAll({
      where: {
        status: 'aprobado',
        workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Plague.findAll({
      where: {
        status: true,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    }),
  ]);

export const getProductsData = async (req, res) => {
  try {
    const query = normalizePublicProductQuery(req.query);
    const { count, rows } = await queryPublishedProducts(query);
    return res.json({
      products: rows.map(buildPublicProductCard),
      totalCount: count,
      totalPages: Math.ceil(count / query.limit) || 1,
      currentPage: query.page,
    });
  } catch (error) {
    console.error('Error al consultar productos públicos:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const renderProductsPublic = async (req, res) => {
  try {
    const query = normalizePublicProductQuery({
      ...req.query,
      limit: req.query?.limit || 12,
    });
    const [{ count, rows }, [cropList, plagueList]] = await Promise.all([
      queryPublishedProducts(query),
      loadPublicFilterCatalogs(),
    ]);
    const pagination = buildPublicPagination(count, query);

    return res.render('public/products', {
      pageTitle: 'Catálogo de Agroquímicos y Productos',
      activePage: 'products',
      products: rows.map(buildPublicProductCard),
      totalCount: count,
      totalPages: pagination.totalPages,
      currentPage: pagination.currentPage,
      pagination,
      search: query.search,
      selectedCategory: query.category,
      selectedHazard: query.hazard,
      selectedCropId: query.cropId,
      selectedPlagueId: query.plagueId,
      hasActiveFilters: Boolean(
        query.search ||
        query.category ||
        query.hazard ||
        query.cropId ||
        query.plagueId,
      ),
      categories: PRODUCT_CATEGORIES.map((value) => ({
        value,
        label: value,
        selected: value === query.category,
      })),
      hazardBands: PRODUCT_HAZARD_BANDS.map((band) => ({
        ...band,
        selected: band.value === query.hazard,
      })),
      cropOptions: cropList.map((crop) => ({
        ...crop,
        selected: Number(crop.id) === query.cropId,
      })),
      plagueOptions: plagueList.map((plague) => ({
        ...plague,
        selected: Number(plague.id) === query.plagueId,
      })),
    });
  } catch (error) {
    console.error('Error al renderizar productos públicos:', error);
    return res.status(500).render('public/products', {
      pageTitle: 'Productos',
      activePage: 'products',
      products: [],
      totalCount: 0,
      error: 'Error al cargar el catálogo de productos.',
    });
  }
};

const detailIncludes = [
  productImageInclude,
  {
    model: Plague,
    as: 'plagues',
    required: false,
    through: { attributes: [] },
    where: {
      status: true,
      workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
    },
    include: [{ model: PlagueImage, as: 'images', required: false }],
  },
  {
    model: Crop,
    as: 'crops',
    required: false,
    through: { attributes: [] },
    where: {
      status: 'aprobado',
      workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
    },
    include: [{ model: CropImage, as: 'images', required: false }],
  },
  {
    model: User,
    as: 'verifiedBy',
    required: false,
    attributes: ['id', 'full_name'],
  },
  {
    model: User,
    as: 'publishedBy',
    required: false,
    attributes: ['id', 'full_name'],
  },
];

const renderPublicNotFound = (res) =>
  res.status(404).render('public/products', {
    pageTitle: 'Producto no encontrado',
    activePage: 'products',
    products: [],
    totalCount: 0,
    error: 'El producto solicitado no existe o no está publicado.',
  });

export const renderProductDetail = async (req, res) => {
  const productId = parsePublicProductId(req.params.id);
  if (!productId) return renderPublicNotFound(res);

  try {
    const record = await Product.findOne({
      where: {
        ...buildPublishedProductWhere(db.Sequelize.Op, {}),
        id: productId,
      },
      include: detailIncludes,
    });
    if (!record) return renderPublicNotFound(res);

    const detail = buildProductDetailView(record);
    if (req.query?.format === 'pdf') {
      return await sendProductPdfResponse(res, detail, {
        download: req.query.download === '1',
        isPrivate: false,
      });
    }
    if (req.query?.format === 'hds') {
      return await sendProductHdsPdfResponse(res, detail, {
        download: req.query.download !== '0',
      });
    }

    return res.render('shared/product-detail', {
      pageTitle: detail.product.name,
      activePage: 'products',
      isPrivate: false,
      ...detail,
      product: detail.product,
    });
  } catch (error) {
    console.error('Error al renderizar el detalle del producto:', error);
    return res.status(500).render('public/products', {
      pageTitle: 'Error',
      activePage: 'products',
      products: [],
      totalCount: 0,
      error: 'Error al cargar el detalle del producto.',
    });
  }
};

export const downloadProductHds = async (req, res) => {
  const productId = parsePublicProductId(req.params.id);
  if (!productId) return renderPublicNotFound(res);

  try {
    const record = await Product.findOne({
      where: {
        ...buildPublishedProductWhere(db.Sequelize.Op, {}),
        id: productId,
      },
      include: detailIncludes,
    });
    if (!record) return renderPublicNotFound(res);

    const detail = buildProductDetailView(record);
    return await sendProductHdsPdfResponse(res, detail, {
      download: req.query?.inline !== '1',
    });
  } catch (error) {
    console.error('Error al generar HDS del producto:', error);
    return res.status(500).send('Error al generar la Hoja de Datos de Seguridad');
  }
};
