import path from 'node:path';
import { fileURLToPath } from 'node:url';

import db from '../../../models/index.js';
import {
  getContextualProductPermissions,
  getProductPermissions,
} from '../../../services/productAuthorizationService.js';
import { buildProductPublicationReadiness } from '../../../services/productReadinessService.js';
import {
  PRODUCT_WORKFLOW_STATUSES,
  isProductEditable,
} from '../../../services/productWorkflowService.js';
import { PRODUCT_CATEGORIES } from '../../../services/productValidationService.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);
const { Product, ProductImage, Plague, Crop } = db;
const normalizeImageUrl = (value) =>
  value
    ? `/${String(value)
        .replace(/^\/+/, '')
        .replace(/^public\/+/, '')}`
    : null;
const parseId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};
const clean = (value, max = 120) =>
  String(value || '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, max);

const productImages = {
  model: ProductImage,
  as: 'images',
  required: false,
  separate: true,
  order: [
    ['is_primary', 'DESC'],
    ['display_order', 'ASC'],
  ],
};

const buildProductView = (record, user) => {
  const product = record.toJSON();
  product.images = (product.images || []).map((image) => ({
    ...image,
    image_url: normalizeImageUrl(image.image_url),
  }));
  const primary =
    product.images.find((image) => image.is_primary) || product.images[0];
  const permissions = getContextualProductPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: product.created_by_user_id,
  });
  return {
    ...product,
    image_url: primary?.image_url || '/images/products/default.png',
    expirationDateFormatted: product.expiration_date
      ?.toISOString?.()
      .slice(0, 10),
    canEditRecord:
      permissions.canEdit && isProductEditable(product.workflow_status),
    canDeleteRecord: permissions.canDelete,
    permissions,
  };
};

export const productsPrivate = async (req, res) => {
  try {
    const search = clean(req.query.search);
    const category = clean(req.query.category, 50);
    const workflow = clean(req.query.workflow || req.query.status, 32);
    const where = {};
    if (search) {
      where[db.Sequelize.Op.or] = [
        { name: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        { active_ingredient: { [db.Sequelize.Op.iLike]: `%${search}%` } },
        { manufacturer: { [db.Sequelize.Op.iLike]: `%${search}%` } },
      ];
    }
    if (category) where.category = category;
    if (workflow) where.workflow_status = workflow;

    const records = await Product.findAll({
      where,
      include: [productImages],
      order: [['createdAt', 'DESC']],
    });
    const now = new Date();
    const expiryLimit = new Date(now);
    expiryLimit.setDate(expiryLimit.getDate() + 60);
    const [
      total,
      published,
      inReview,
      changesRequested,
      expiringRecords,
      cropOptions,
      plagueOptions,
    ] = await Promise.all([
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
          expiration_date: { [db.Sequelize.Op.between]: [now, expiryLimit] },
        },
        order: [['expiration_date', 'ASC']],
      }),
      Crop.findAll({
        where: {
          status: 'aprobado',
          workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
        },
        attributes: ['id', 'name', 'scientific_name'],
        order: [['name', 'ASC']],
        raw: true,
      }),
      Plague.findAll({
        where: {
          status: true,
          workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        },
        attributes: ['id', 'name', 'scientific_name'],
        order: [['name', 'ASC']],
        raw: true,
      }),
    ]);
    return res.render('private/catalog/products', {
      layout: privateLayout,
      pageTitle: 'Gestión de Productos Agroquímicos',
      activePage: 'products',
      products: records.map((record) => buildProductView(record, req.user)),
      permissions: getProductPermissions(req.user.role),
      filters: { search, category, workflow },
      stats: {
        total,
        published,
        inReview,
        changesRequested,
      },
      expiringSoon: expiringRecords.length,
      relationOptions: { crops: cropOptions, plagues: plagueOptions },
      expiringProducts: expiringRecords.map((record) => {
        const product = buildProductView(record, req.user);
        return {
          ...product,
          expiration_date_formatted: product.expiration_date
            ?.toISOString?.()
            .slice(0, 10),
        };
      }),
      searchId: 'product-search',
      searchValue: search,
      searchPlaceholder: 'Buscar por producto, ingrediente o fabricante...',
      searchFilters: [
        {
          id: 'filter-category',
          param: 'category',
          label: 'Categoría:',
          options: PRODUCT_CATEGORIES.map((value) => ({
            value,
            text: value,
            selected: value === category,
          })),
        },
        {
          id: 'filter-workflow',
          param: 'workflow',
          label: 'Estatus:',
          options: [
            ['draft', 'Borrador'],
            ['in_review', 'En revisión'],
            ['changes_requested', 'Cambios solicitados'],
            ['verified', 'Verificado'],
            ['published', 'Publicado'],
            ['archived', 'Archivado'],
          ].map(([value, text]) => ({
            value,
            text,
            selected: value === workflow,
          })),
        },
      ],
      ctaLabel: getProductPermissions(req.user.role).canCreate
        ? 'Añadir producto'
        : null,
      ctaIcon: 'science',
      ctaBtnId: 'btn-add-product',
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al listar productos en panel privado:', error);
    return res.status(500).send('Error interno al cargar los productos.');
  }
};

export const getProductDetail = async (req, res) => {
  const productId = parseId(req.params.id);
  if (!productId) return res.status(400).send('ID de producto no válido.');

  try {
    const record = await Product.findByPk(productId, {
      include: [
        productImages,
        { model: Plague, as: 'plagues', through: { attributes: [] } },
        { model: Crop, as: 'crops', through: { attributes: [] } },
      ],
    });
    if (!record) return res.status(404).send('Producto no encontrado.');

    const product = buildProductView(record, req.user);
    const readiness = buildProductPublicationReadiness(product);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        product,
        permissions: product.permissions,
        readiness,
      });
    }
    return res.render('shared/product-detail', {
      layout: privateLayout,
      isPrivate: true,
      pageTitle: `Ficha Técnica: ${product.name}`,
      activePage: 'products',
      product,
      permissions: product.permissions,
      readiness,
      canEditRecord: product.canEditRecord,
    });
  } catch (error) {
    console.error('Error al obtener el producto privado:', error);
    return res.status(500).send('Error interno al obtener el producto.');
  }
};
