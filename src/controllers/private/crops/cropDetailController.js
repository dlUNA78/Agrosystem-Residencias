import path from 'node:path';
import { fileURLToPath } from 'node:url';

import db from '../../../models/index.js';
import {
  getContextualCropPermissions,
  getCropPermissions,
} from '../../../services/cropAuthorizationService.js';
import { buildCropDetailView } from '../../../services/cropDetailService.js';
import { sendCropPdfResponse } from '../../../services/cropPdfService.js';
import { buildCropPublicationReadiness } from '../../../services/cropReadinessService.js';
import { buildCropRelationEditor } from '../../../services/cropRelationService.js';
import { isCropEditable } from '../../../services/cropWorkflowService.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);

const {
  Crop,
  CropImage,
  Farm,
  Plague,
  PlagueImage,
  Product,
  ProductImage,
  User,
} = db;

const cropDetailIncludes = [
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
  {
    model: Plague,
    as: 'plagues',
    required: false,
    include: [{ model: PlagueImage, as: 'images', required: false }],
  },
  {
    model: Product,
    as: 'products',
    required: false,
    include: [{ model: ProductImage, as: 'images', required: false }],
  },
  { model: Farm, as: 'farms', required: false },
  {
    model: User,
    as: 'verifiedBy',
    required: false,
    attributes: ['id', 'full_name'],
  },
];

const parseCropId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

const normalizeEditableImage = (img) => ({
  id: img.id,
  image_url: img.image_url
    ? `/${String(img.image_url)
        .trim()
        .replaceAll('\\', '/')
        .replace(/^\/+/, '')
        .replace(/^public\/+/, '')}`
    : null,
  url: img.image_url
    ? `/${String(img.image_url)
        .trim()
        .replaceAll('\\', '/')
        .replace(/^\/+/, '')
        .replace(/^public\/+/, '')}`
    : null,
  original_name: img.original_name || null,
  is_primary: Boolean(img.is_primary),
  display_order: Number(img.display_order) || 0,
});

const normalizeImages = (images = []) =>
  Array.isArray(images)
    ? images.map(normalizeEditableImage).filter((img) => img.image_url)
    : [];

const loadRelationEditor = async (cropData) => {
  const [plagues, products] = await Promise.all([
    Plague.findAll({
      attributes: ['id', 'name', 'scientific_name', 'category'],
      order: [['name', 'ASC']],
    }),
    Product.findAll({
      attributes: ['id', 'name', 'category', 'active_ingredient'],
      order: [['name', 'ASC']],
    }),
  ]);

  return buildCropRelationEditor({
    plagues,
    products,
    selectedPlagues: cropData.plagues,
    selectedProducts: cropData.products,
  });
};

const resolveDetailEditState = (user, cropData) => {
  const permissions = getContextualCropPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: cropData.created_by_user_id,
  });
  const rolePermissions = getCropPermissions(user.role);
  const editableStatus = isCropEditable(cropData.workflow_status);

  return {
    permissions,
    canEditRecord: permissions.canEdit && editableStatus,
    canEditRelations: permissions.canManageRelations && editableStatus,
    relationsLocked: rolePermissions.canManageRelations && !editableStatus,
    relationsOwnershipRestricted:
      rolePermissions.canManageRelations &&
      editableStatus &&
      !permissions.canManageRelations,
  };
};

const buildEditableCropPayload = (cropData, images) => {
  const primaryImage =
    images.find((img) => img.is_primary === true) || images[0] || null;

  return {
    ...cropData,
    images,
    image_url: primaryImage?.image_url || '',
    images_json: JSON.stringify(images),
  };
};

const sendHtmlDetail = async (req, res, options) => {
  const { cropData, detail, editState, images, primaryImage, readiness } =
    options;

  if (req.query?.format === 'pdf') {
    return await sendCropPdfResponse(res, detail, {
      download: req.query.download === '1',
      isPrivate: true,
    });
  }

  const relationEditor = editState.canEditRelations
    ? await loadRelationEditor(cropData)
    : null;

  const editableCrop = buildEditableCropPayload(cropData, images);

  return res.render('shared/crop-detail', {
    layout: privateLayout,
    pageTitle: detail.crop.commonName || detail.crop.name,
    activePage: 'crops',
    isPrivate: true,
    readiness,
    ...editState,
    editableCrop,
    relationEditor,
    ...detail,
    crop: { ...cropData, ...detail.crop },
    primaryImage: primaryImage?.image_url || null,
    carouselImages: images,
    extraScripts:
      '<script type="module" src="/js/shared/crop-detail.js?v=2.0"></script>',
  });
};

export const getCropDetail = async (req, res) => {
  const cropId = parseCropId(req.params.id);
  if (!cropId) return res.status(400).send('ID de cultivo no válido');

  try {
    const cropRecord = await Crop.findByPk(cropId, {
      include: cropDetailIncludes,
    });

    if (!cropRecord) return res.status(404).send('Cultivo no encontrado');

    const cropData = cropRecord.toJSON();
    const images = normalizeImages(cropData.images);
    const primaryImage =
      images.find((img) => img.is_primary === true) || images[0] || null;
    const editState = resolveDetailEditState(req.user, cropData);
    const readiness = buildCropPublicationReadiness({ ...cropData, images });
    const viewCrop = {
      ...cropData,
      images,
      image_url: primaryImage?.image_url,
    };

    const wantsJson =
      req.xhr || req.headers.accept?.includes('application/json');

    if (wantsJson) {
      return res.json({
        success: true,
        crop: viewCrop,
        permissions: editState.permissions,
        readiness,
      });
    }

    const detail = buildCropDetailView(cropData);

    return await sendHtmlDetail(req, res, {
      cropData,
      detail,
      editState,
      images,
      primaryImage,
      readiness,
    });
  } catch (error) {
    console.error('Error al obtener el cultivo:', error);
    return res.status(500).send('Error al obtener el cultivo');
  }
};
