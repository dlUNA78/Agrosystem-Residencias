import db from '../../models/index.js';
import {
  buildPublishedProductWhere,
  normalizePublicProductQuery,
  parsePublicProductId,
} from '../../services/productPublicQueryService.js';
import { CROP_WORKFLOW_STATUSES } from '../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../services/plagueWorkflowService.js';

const { Product, ProductImage, Plague, Crop } = db;
const normalizeImagePath = (value) => {
  if (!value) return null;
  const relative = String(value)
    .trim()
    .replace(/^\/+/, '')
    .replace(/^public\/+/, '');
  return relative ? `/${relative}` : null;
};
const productImageInclude = {
  model: ProductImage,
  as: 'images',
  required: false,
};
const riskThemes = Object.freeze({
  Alto: { label: 'Crítico', badgeClass: 'bg-rose-50 text-rose-800' },
  Medio: { label: 'Moderado', badgeClass: 'bg-amber-50 text-amber-800' },
  Bajo: { label: 'Bajo', badgeClass: 'bg-emerald-50 text-emerald-800' },
});
const buildPublicProduct = (record) => {
  const product = record.toJSON();
  const primary =
    product.images?.find((image) => image.is_primary) || product.images?.[0];
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    active_ingredient: product.active_ingredient,
    registration_code: product.registration_code,
    manufacturer: product.manufacturer,
    validation_status: product.validation_status,
    expiration_date: product.expiration_date,
    target_crops: product.target_crops,
    description: product.description,
    mode_of_action: product.mode_of_action,
    hazard_category: product.hazard_category,
    suggested_dosage: product.suggested_dosage,
    safety_interval_days: product.safety_interval_days,
    formulation_type: product.formulation_type,
    safety_sheet_url: product.safety_sheet_url,
    plagues: product.plagues,
    crops: product.crops,
    images: (product.images || []).map((image) => ({
      is_primary: image.is_primary,
      display_order: image.display_order,
      image_url: normalizeImagePath(image.image_url),
    })),
    image_url:
      normalizeImagePath(primary?.image_url || product.image_url) ||
      '/images/products/default.png',
  };
};

const queryPublishedProducts = async (query) => {
  const where = buildPublishedProductWhere(db.Sequelize.Op, query);
  const offset = (query.page - 1) * query.limit;
  return Product.findAndCountAll({
    where,
    include: [productImageInclude],
    order: [['name', 'ASC']],
    limit: query.limit,
    offset,
    distinct: true,
  });
};

export const getProductsData = async (req, res) => {
  try {
    const query = normalizePublicProductQuery(req.query);
    const { count, rows } = await queryPublishedProducts(query);
    return res.json({
      products: rows.map(buildPublicProduct),
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
    const query = normalizePublicProductQuery({ ...req.query, limit: 24 });
    const { count, rows } = await queryPublishedProducts(query);
    return res.render('public/products', {
      pageTitle: 'Catálogo de Agroquímicos y Productos',
      activePage: 'products',
      products: rows.map(buildPublicProduct),
      totalCount: count,
      search: query.search,
    });
  } catch (error) {
    console.error('Error al renderizar productos públicos:', error);
    return res.status(500).render('public/products', {
      pageTitle: 'Productos',
      activePage: 'products',
      products: [],
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
    include: [{ model: db.PlagueImage, as: 'images', required: false }],
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
    include: [{ model: db.CropImage, as: 'images', required: false }],
  },
];
const normalizeRelatedImages = (records = [], fallback) =>
  records.map((record) => {
    const image =
      record.images?.find((candidate) => candidate.is_primary) ||
      record.images?.[0];
    return {
      id: record.id,
      name: record.name,
      scientific_name: record.scientific_name,
      category: record.category,
      description: record.description,
      risk_level: record.risk_level,
      riskTheme: riskThemes[record.risk_level] || riskThemes.Bajo,
      image_url:
        normalizeImagePath(image?.image_url || record.image_url) || fallback,
    };
  });

export const renderProductDetail = async (req, res) => {
  const productId = parsePublicProductId(req.params.id);
  if (!productId) {
    return res.status(404).render('shared/product-detail', {
      pageTitle: 'Producto no encontrado',
      error: 'El producto solicitado no existe o no está publicado.',
    });
  }

  try {
    const record = await Product.findOne({
      where: {
        ...buildPublishedProductWhere(db.Sequelize.Op, { search: '' }),
        id: productId,
      },
      include: detailIncludes,
    });
    if (!record) {
      return res.status(404).render('shared/product-detail', {
        pageTitle: 'Producto no encontrado',
        error: 'El producto solicitado no existe o no está publicado.',
      });
    }
    return renderPublishedProduct(res, record);
  } catch (error) {
    console.error('Error al renderizar el detalle del producto:', error);
    return res.status(500).render('shared/product-detail', {
      pageTitle: 'Error',
      error: 'Error al cargar el detalle del producto.',
    });
  }
};

const renderPublishedProduct = (res, record) => {
  const product = buildPublicProduct(record);
  product.plagues = normalizeRelatedImages(
    product.plagues,
    '/images/plagas/pulgon-verde.webp',
  );
  product.crops = normalizeRelatedImages(
    product.crops,
    '/images/test/default.png',
  );
  return res.render('shared/product-detail', {
    pageTitle: product.name,
    activePage: 'products',
    isPrivate: false,
    product,
  });
};
