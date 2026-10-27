import db from '../../../models/index.js';
import {
  getContextualPlaguePermissions,
  getPlaguePermissions,
} from '../../../services/plagueAuthorizationService.js';
import { buildPlagueDetailView } from '../../../services/plagueDetailService.js';
import { sendPlaguePdfResponse } from '../../../services/plaguePdfService.js';
import { buildPlagueRelationEditor } from '../../../services/plagueRelationService.js';
import { buildPlaguePublicationReadiness } from '../../../services/plagueReadinessService.js';
import { isPlagueEditable } from '../../../services/plagueWorkflowService.js';
import { privateLayout } from './plagueControllerUtils.js';

const { Crop, Plague, PlagueImage, Product, ProductImage, Region } = db;

const plagueDetailIncludes = [
  {
    model: PlagueImage,
    as: 'images',
    required: false,
    separate: true,
    order: [['sort_order', 'ASC']],
  },
  {
    model: Product,
    as: 'products',
    required: false,
    include: [{ model: ProductImage, as: 'images', required: false }],
  },
  {
    model: Region,
    as: 'regions',
    required: false,
    through: { attributes: ['risk_level'] },
  },
  {
    model: Crop,
    as: 'crops',
    required: false,
    through: { attributes: [] },
  },
];

const loadRelationEditor = async (plagueData) => {
  const [products, crops, regions] = await Promise.all([
    Product.findAll({
      attributes: ['id', 'name', 'active_ingredient'],
      order: [['name', 'ASC']],
    }),
    Crop.findAll({
      attributes: ['id', 'name', 'scientific_name'],
      order: [['name', 'ASC']],
    }),
    Region.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    }),
  ]);

  return buildPlagueRelationEditor({
    products,
    crops,
    regions,
    selectedProducts: plagueData.products,
    selectedCrops: plagueData.crops,
    selectedRegions: plagueData.regions,
  });
};

const normalizeEditableImage = (img) => ({
  id: img.id,
  url: `/${String(img.url).replace(/^\/+/, '')}`,
  ...(img.caption ? { caption: img.caption } : {}),
  ...(img.source ? { source: img.source } : {}),
  sort_order: img.sort_order ?? 0,
});

const normalizeEditableImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images.filter((img) => img?.url).map(normalizeEditableImage);
};

const TEXT_FIELDS = [
  'name',
  'scientific_name',
  'category',
  'region',
  'description',
  'symptoms',
  'control_methods',
  'biological_control',
];

const buildEditablePlaguePayload = (plagueData) => {
  const normalizedImages = normalizeEditableImages(plagueData.images);
  const textPayload = Object.fromEntries(
    TEXT_FIELDS.map((field) => [field, plagueData[field] ?? '']),
  );

  return {
    id: plagueData.id,
    ...textPayload,
    risk_level: plagueData.risk_level ?? 'Bajo',
    image_url: normalizedImages[0]?.url ?? '',
    images_json: JSON.stringify(normalizedImages),
    biological_cycle_json: JSON.stringify(plagueData.biological_cycle ?? []),
  };
};

const parseValidPlagueId = (rawId) => {
  if (!/^\d+$/.test(rawId)) return null;
  const numericId = Number(rawId);
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
};

const resolveDetailEditState = (user, plagueData) => {
  const permissions = getContextualPlaguePermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: plagueData.created_by_user_id,
  });
  const rolePermissions = getPlaguePermissions(user.role);
  const editableStatus = isPlagueEditable(plagueData.workflow_status);
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

export const getPlagueDetail = async (req, res) => {
  try {
    const plagueId = parseValidPlagueId(req.params.id);
    if (!plagueId) {
      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(plagueId, {
      include: plagueDetailIncludes,
    });
    if (!plague) {
      return res.status(404).send('Plaga no encontrada');
    }

    const plagueData = plague.toJSON();
    const detail = buildPlagueDetailView(plagueData);
    if (req.query?.format === 'pdf') {
      return sendPlaguePdfResponse(res, detail, {
        download: req.query.download === '1',
        isPrivate: true,
      });
    }
    const readiness = buildPlaguePublicationReadiness(plagueData);
    const editState = resolveDetailEditState(req.user, plagueData);
    const relationEditor = editState.canEditRelations
      ? await loadRelationEditor(plagueData)
      : null;

    return res.render('shared/plague-detail', {
      layout: privateLayout,
      pageTitle: `${detail.plague.name} - Plagas`,
      activePage: 'plagues',
      isPrivate: true,
      readiness,
      ...editState,
      editablePlague: buildEditablePlaguePayload(plagueData),
      relationEditor,
      ...detail,
      extraScripts:
        '<script type="module" src="/js/shared/plague-detail.js?v=2.8"></script>',
    });
  } catch (error) {
    console.error('Error al cargar el detalle de la plaga:', error);
    return res.status(500).send('Error al cargar el detalle de la plaga');
  }
};
