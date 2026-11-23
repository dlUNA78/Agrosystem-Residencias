import path from 'node:path';
import { fileURLToPath } from 'node:url';

import db from '../../../models/index.js';
import {
  getContextualCropPermissions,
  getCropPermissions,
} from '../../../services/cropAuthorizationService.js';
import { buildCropDetailView } from '../../../services/cropDetailService.js';
import {
  countNationalActiveFarmsForCrop,
  loadPrivateCropFarmSummary,
} from '../../../services/cropFarmSummaryService.js';
import { sendCropPdfResponse } from '../../../services/cropPdfService.js';
import { buildCropPublicationReadiness } from '../../../services/cropReadinessService.js';
import { buildCropRelationEditor } from '../../../services/cropRelationService.js';
import {
  CROP_WORKFLOW_STATUSES,
  isCropEditable,
} from '../../../services/cropWorkflowService.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);

const { Crop, CropImage, Plague, PlagueImage, Product, ProductImage, User } =
  db;

// Nota 1.A11: se separó únicamente la carga de predios (FarmCrops/Farms) en
// cropFarmSummaryService.js. Plagas y productos se mantienen inline porque sus
// catálogos tienen < 10 filas y separarlos duplicaba consultas/latencia sin ganancia.
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
  {
    model: User,
    as: 'verifiedBy',
    required: false,
    attributes: ['id', 'full_name'],
  },
  {
    model: User,
    as: 'archiveRequestedBy',
    required: false,
    attributes: ['id', 'full_name'],
  },
  {
    model: User,
    as: 'archivedBy',
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
  source: img.source || null,
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

const loadCropFormRelationOptions = async () => {
  const [plagues, products] = await Promise.all([
    Plague?.findAll
      ? Plague.findAll({
          where: { status: true, workflow_status: 'published' },
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
  return { plagues, products };
};

const isControlledCropStage = (status) =>
  status === CROP_WORKFLOW_STATUSES.VERIFIED ||
  status === CROP_WORKFLOW_STATUSES.PUBLISHED;

const canRolePerformControlledEdit = (role, status) =>
  ['admin', 'inifap'].includes(role) && isControlledCropStage(status);

const resolveDetailEditState = (user, cropData) => {
  const permissions = getContextualCropPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: cropData.created_by_user_id,
    archiveRequestedByUserId: cropData.archive_requested_by_user_id,
  });
  const rolePermissions = getCropPermissions(user.role);
  const editableStatus = isCropEditable(cropData.workflow_status);
  const isDraftEditable = permissions.canEdit && editableStatus;
  const canControlledEdit = canRolePerformControlledEdit(
    user.role,
    cropData.workflow_status,
  );

  return {
    permissions: {
      ...permissions,
      canEdit: permissions.canEdit || canControlledEdit,
    },
    canEditRecord: isDraftEditable || canControlledEdit,
    isControlledEdit: !isDraftEditable && canControlledEdit,
    canDeleteRecord:
      permissions.canDelete &&
      cropData.workflow_status === CROP_WORKFLOW_STATUSES.DRAFT,
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

  const [relationEditor, relationOptions] = await Promise.all([
    editState.canEditRelations ? loadRelationEditor(cropData) : null,
    loadCropFormRelationOptions(),
  ]);

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
    relationOptions,
    ...detail,
    crop: { ...cropData, ...detail.crop },
    primaryImage: primaryImage?.image_url || null,
    carouselImages: images,
    extraScripts:
      '<script type="module" src="/js/shared/crop-detail.js?v=2.0"></script>',
  });
};

const loadCropWithContext = async (cropId, userId, { wantsJson, wantsPdf }) => {
  const cropPromise = Crop.findByPk(cropId, { include: cropDetailIncludes });

  if (wantsPdf) {
    const cropRecord = await cropPromise;
    return {
      cropRecord,
      farmSummary: { farmsCount: 0, ownFarmsCount: 0, farms: [] },
    };
  }

  if (wantsJson) {
    const [cropRecord, farmsCount] = await Promise.all([
      cropPromise,
      countNationalActiveFarmsForCrop(cropId),
    ]);
    return {
      cropRecord,
      farmSummary: { farmsCount, ownFarmsCount: 0, farms: [] },
    };
  }

  const [cropRecord, farmSummary] = await Promise.all([
    cropPromise,
    loadPrivateCropFarmSummary(cropId, userId),
  ]);
  return { cropRecord, farmSummary };
};

const resolveDetailResponseMode = (req) => {
  const wantsJson = Boolean(
    req.xhr || req.headers.accept?.includes('application/json'),
  );
  const wantsPdf = !wantsJson && req.query?.format === 'pdf';
  return { wantsJson, wantsPdf };
};

const findPrimaryImage = (images) =>
  images.find((img) => img.is_primary === true) || images[0] || null;

const sendJsonDetail = (
  res,
  { cropData, farmsCount, images, primaryImage, editState, readiness },
) =>
  res.json({
    success: true,
    crop: {
      ...cropData,
      farmsCount,
      images,
      image_url: primaryImage?.image_url,
      canEditRecord: editState.canEditRecord,
      isControlledEdit: editState.isControlledEdit,
    },
    farmsCount,
    permissions: editState.permissions,
    readiness,
  });

export const getCropDetail = async (req, res) => {
  const cropId = parseCropId(req.params.id);
  if (!cropId) return res.status(400).send('ID de cultivo no válido');

  try {
    const mode = resolveDetailResponseMode(req);
    const { cropRecord, farmSummary } = await loadCropWithContext(
      cropId,
      req.user?.id,
      mode,
    );

    if (!cropRecord) return res.status(404).send('Cultivo no encontrado');

    const cropData = cropRecord.toJSON();
    const images = normalizeImages(cropData.images);
    const primaryImage = findPrimaryImage(images);
    const editState = resolveDetailEditState(req.user, cropData);
    const readiness = buildCropPublicationReadiness({ ...cropData, images });

    if (mode.wantsJson) {
      return sendJsonDetail(res, {
        cropData,
        farmsCount: farmSummary.farmsCount,
        images,
        primaryImage,
        editState,
        readiness,
      });
    }

    if (mode.wantsPdf) {
      const detail = buildCropDetailView(cropData);
      return await sendCropPdfResponse(res, detail, {
        download: req.query.download === '1',
        isPrivate: true,
      });
    }

    const detail = buildCropDetailView(
      { ...cropData, farms: farmSummary.farms },
      {
        farmsCount: farmSummary.farmsCount,
        ownFarmsCount: farmSummary.ownFarmsCount,
      },
    );

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
