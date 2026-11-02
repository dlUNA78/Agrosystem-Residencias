import db from '../../../models/index.js';
import { getContextualProductPermissions } from '../../../services/productAuthorizationService.js';
import { buildProductDetailView } from '../../../services/productDetailService.js';
import { sendProductPdfResponse } from '../../../services/productPdfService.js';
import { buildProductPublicationReadiness } from '../../../services/productReadinessService.js';
import { buildProductRelationEditor } from '../../../services/productRelationService.js';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_HAZARD_BANDS,
  normalizeHazardCategory,
} from '../../../services/productValidationService.js';
import { isProductEditable } from '../../../services/productWorkflowService.js';
import {
  loadFormCatalogOptions,
  normalizeImageUrl,
  parsePositiveId,
  privateLayout,
} from './productControllerUtils.js';

const { Crop, CropImage, Plague, PlagueImage, Product, ProductImage, User } =
  db;

const detailIncludes = [
  {
    model: ProductImage,
    as: 'images',
    required: false,
    separate: true,
    order: [
      ['is_primary', 'DESC'],
      ['display_order', 'ASC'],
    ],
  },
  {
    model: Plague,
    as: 'plagues',
    required: false,
    through: { attributes: [] },
    include: [{ model: PlagueImage, as: 'images', required: false }],
  },
  {
    model: Crop,
    as: 'crops',
    required: false,
    through: { attributes: [] },
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

const wantsJsonResponse = (req) =>
  Boolean(req.xhr || req.headers.accept?.includes('application/json'));

const buildJsonEditableProduct = (rawRecord, permissions) => {
  const raw = rawRecord.toJSON();
  const images = (raw.images || [])
    .map((img) => {
      const url = normalizeImageUrl(img.image_url);
      return {
        id: img.id,
        image_url: url,
        url,
        original_name: img.original_name || null,
        is_primary: Boolean(img.is_primary),
        display_order: Number(img.display_order) || 0,
      };
    })
    .filter((img) => img.image_url);
  const primary = images.find((img) => img.is_primary) || images[0];

  return {
    ...raw,
    hazard_category:
      normalizeHazardCategory(raw.hazard_category) || raw.hazard_category,
    images,
    image_url: primary?.image_url || '/images/products/default.png',
    expirationDateFormatted: raw.expiration_date?.toISOString?.().slice(0, 10),
    canEditRecord:
      permissions.canEdit && isProductEditable(raw.workflow_status),
    canDeleteRecord: permissions.canDelete,
    permissions,
  };
};

const renderPrivateProductHtml = async (
  req,
  res,
  { record, detail, editablePayload, permissions, readiness },
) => {
  const catalogOptions = await loadFormCatalogOptions();
  const relationEditor = buildProductRelationEditor({
    product: editablePayload,
    crops: catalogOptions.crops,
    plagues: catalogOptions.plagues,
  });
  const isEditableStage = isProductEditable(record.workflow_status);
  const role = req.user ? req.user.role : '';

  return res.render('shared/product-detail', {
    layout: privateLayout,
    isPrivate: true,
    isAdmin: role === 'admin',
    isInifap: role === 'inifap',
    pageTitle: `Ficha Técnica: ${detail.product.name}`,
    activePage: 'products',
    ...detail,
    product: {
      ...detail.product,
      canEditRecord: permissions.canEdit && isEditableStage,
      canDeleteRecord: permissions.canDelete,
    },
    permissions,
    readiness,
    canEditRecord: permissions.canEdit && isEditableStage,
    canManageRelations: permissions.canManageRelations && isEditableStage,
    relationEditor,
    relationOptions: {
      crops: catalogOptions.crops,
      plagues: catalogOptions.plagues,
    },
    activeIngredients: catalogOptions.ingredients,
    productCategories: PRODUCT_CATEGORIES,
    hazardCategories: PRODUCT_HAZARD_BANDS,
  });
};

export const getProductDetail = async (req, res) => {
  const productId = parsePositiveId(req.params.id);
  if (!productId) return res.status(400).send('ID de producto no válido.');

  try {
    const record = await Product.findByPk(productId, {
      include: detailIncludes,
    });
    if (!record) return res.status(404).send('Producto no encontrado.');

    const permissions = getContextualProductPermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: record.created_by_user_id,
    });
    const editablePayload = buildJsonEditableProduct(record, permissions);
    const readiness = buildProductPublicationReadiness(editablePayload);

    if (wantsJsonResponse(req)) {
      return res.json({
        success: true,
        product: editablePayload,
        permissions,
        readiness,
      });
    }

    const detail = buildProductDetailView(record);
    if (req.query?.format === 'pdf') {
      return await sendProductPdfResponse(res, detail, {
        download: req.query.download === '1',
        isPrivate: true,
      });
    }

    return await renderPrivateProductHtml(req, res, {
      record,
      detail,
      editablePayload,
      permissions,
      readiness,
    });
  } catch (error) {
    console.error('Error al obtener el producto privado:', error);
    return res.status(500).send('Error interno al obtener el producto.');
  }
};
