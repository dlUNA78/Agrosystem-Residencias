import db from '../../../models/index.js';
import {
  getContextualPlaguePermissions,
  getPlaguePermissions,
} from '../../../services/plagueAuthorizationService.js';
import { buildPlagueDetailView } from '../../../services/plagueDetailService.js';
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

export const getPlagueDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      return res.status(400).send('ID de plaga no válido');
    }

    const plagueId = Number(id);
    if (!Number.isSafeInteger(plagueId) || plagueId <= 0) {
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
    const readiness = buildPlaguePublicationReadiness(plagueData);
    const permissions = getContextualPlaguePermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: plagueData.created_by_user_id,
    });
    const rolePermissions = getPlaguePermissions(req.user.role);
    const editableStatus = isPlagueEditable(plagueData.workflow_status);
    const canEditRelations = permissions.canManageRelations && editableStatus;
    const relationEditor = canEditRelations
      ? await loadRelationEditor(plagueData)
      : null;

    return res.render('shared/plague-detail', {
      layout: privateLayout,
      pageTitle: `${detail.plague.name} - Plagas`,
      activePage: 'plagues',
      isPrivate: true,
      permissions,
      readiness,
      canEditRelations,
      relationsLocked: rolePermissions.canManageRelations && !editableStatus,
      relationsOwnershipRestricted:
        rolePermissions.canManageRelations &&
        editableStatus &&
        !permissions.canManageRelations,
      relationEditor,
      ...detail,
      extraScripts: '<script src="/js/shared/plague-detail.js"></script>',
    });
  } catch (error) {
    console.error('Error al cargar el detalle de la plaga:', error);
    return res.status(500).send('Error al cargar el detalle de la plaga');
  }
};
