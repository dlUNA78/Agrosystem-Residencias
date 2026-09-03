import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';
import {
  canPerformContextualPlagueWorkflowAction,
  getContextualPlaguePermissions,
  getPlaguePermissions,
} from '../../services/plagueAuthorizationService.js';
import { buildPlagueDetailView } from '../../services/plagueDetailService.js';
import {
  PRIVATE_PLAGUE_PAGE_SIZE,
  buildPrivatePlaguePagination,
  normalizePrivatePlagueListQuery,
} from '../../services/plagueListService.js';
import {
  buildPlagueRelationEditor,
  validatePlagueRelationsInput,
} from '../../services/plagueRelationService.js';
import {
  buildPlaguePublicationReadiness,
  requiresPlagueReadiness,
} from '../../services/plagueReadinessService.js';
import { validatePlagueInput } from '../../services/plagueValidationService.js';
import {
  PLAGUE_WORKFLOW_ACTIONS,
  PLAGUE_WORKFLOW_STATUSES,
  PlagueWorkflowError,
  isPlagueEditable,
  transitionPlagueWorkflow,
} from '../../services/plagueWorkflowService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const {
  Plague,
  PlagueImage,
  PlagueRegion,
  Product,
  ProductImage,
  Region,
  Crop,
  AuditLog,
} = db;

const getRecordId = (record) => Number(record?.id ?? record?.dataValues?.id);

const getWorkflowReadiness = async (plague, transaction) => {
  const [imageCount, cropCount, regionCount] = await Promise.all([
    PlagueImage.count({
      where: { plague_id: plague.id },
      transaction,
    }),
    plague.countCrops({ transaction }),
    plague.countRegions({ transaction }),
  ]);

  return buildPlaguePublicationReadiness(plague.toJSON(), {
    imageCount,
    cropCount,
    regionCount,
  });
};

const findMissingCatalogIds = async (Model, ids, transaction) => {
  if (ids.length === 0) {
    return [];
  }

  const records = await Model.findAll({
    where: { id: ids },
    attributes: ['id'],
    transaction,
  });
  const existingIds = new Set(records.map(getRecordId));

  return ids.filter((id) => !existingIds.has(id));
};

// LISTADO DE PLAGAS

export const plaguesPrivate = async (req, res) => {
  try {
    const query = normalizePrivatePlagueListQuery(req.query);
    const { search, category, workflow } = query;

    const { Op } = db.Sequelize;

    const where = {};

    // BUSCADOR

    if (search.trim()) {
      const searchTerm = search.trim();

      where[Op.or] = [
        {
          name: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
        {
          scientific_name: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
        {
          region: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
        {
          symptoms: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
      ];

      if (/^\d+$/.test(searchTerm)) {
        const searchedId = Number(searchTerm);

        if (Number.isSafeInteger(searchedId) && searchedId > 0) {
          where[Op.or].push({ id: searchedId });
        }
      }
    }

    // FILTRO POR CATEGORÍA

    if (category.trim()) {
      where.category = category;
    }

    // FILTRO POR ESTADO EDITORIAL

    if (Object.values(PLAGUE_WORKFLOW_STATUSES).includes(workflow)) {
      where.workflow_status = workflow;
    }

    // PAGINACIÓN Y CONSULTA DE PLAGAS + IMÁGENES

    const filteredCount = await Plague.count({ where });
    const pagination = buildPrivatePlaguePagination({
      requestedPage: query.page,
      totalItems: filteredCount,
      filters: { search, category, workflow },
    });

    const plagueRecords = await Plague.findAll({
      where,

      limit: PRIVATE_PLAGUE_PAGE_SIZE,

      offset: (pagination.currentPage - 1) * PRIVATE_PLAGUE_PAGE_SIZE,

      include: [
        {
          model: PlagueImage,
          as: 'images',
          required: false,
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],

      order: [['createdAt', 'DESC']],
    });

    // FORMATEAR DATOS PARA HANDLEBARS

    const currentUser = req.user;
    const userRole = currentUser.role;
    const permissions = getPlaguePermissions(userRole);

    const plagues = plagueRecords.map((plague) => {
      const data = plague.toJSON();

      const images = Array.isArray(data.images) ? data.images : [];
      const normalizedImages = images.map((image) => ({
        url: `/${String(image.url).replace(/^\/+/, '')}`,
        ...(image.caption ? { caption: image.caption } : {}),
        ...(image.source ? { source: image.source } : {}),
        sort_order: image.sort_order || 0,
      }));
      const recordPermissions = getContextualPlaguePermissions({
        role: userRole,
        userId: currentUser.id,
        createdByUserId: data.created_by_user_id,
      });

      return {
        ...data,

        // Primera imagen para tabla/grid
        image_url: normalizedImages.length > 0 ? normalizedImages[0].url : null,

        // Todas las imágenes disponibles
        images,

        images_json: JSON.stringify(normalizedImages),

        // JSON seguro para reconstruir el editor por etapas en el modal.
        biological_cycle_json: JSON.stringify(data.biological_cycle || []),

        canEditRecord:
          recordPermissions.canEdit && isPlagueEditable(data.workflow_status),
      };
    });

    // CALCULAR ESTADÍSTICAS ADMINISTRATIVAS (KPIS)
    const totalPlagues = await Plague.count();
    const activePlagues = await Plague.count({
      where: { workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED },
    });
    const criticalPlagues = await Plague.count({
      where: {
        risk_level: {
          [Op.or]: ['Crítico', 'Alto', 'critico', 'alto'],
        },
      },
    });
    const pendingVerification = await Plague.count({
      where: { workflow_status: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW },
    });

    // RBAC Y ROLES DE USUARIO
    const isAdmin = userRole === 'admin';
    const isInifap = userRole === 'inifap' || userRole === 'admin';

    // VISTA
    return res.render('private/catalog/plagues', {
      layout: privateLayout,

      pageTitle: 'Gestión Fitosanitaria - Plagas',

      activePage: 'plagues',

      plagues,

      filters: {
        search,
        category,
        workflow,
      },

      hasActiveFilters: Boolean(search || category || workflow),

      pagination,

      stats: {
        totalPlagues,
        activePlagues,
        criticalPlagues,
        pendingVerification,
      },

      permissions,
      isAdmin,
      isInifap,

      // SEARCH BAR REUTILIZABLE

      searchId: 'plague-search',

      searchPlaceholder: 'Buscar por nombre, especie o cultivo afectado...',

      searchFilters: [
        {
          id: 'filter-category',

          label: 'Categoría:',

          options: [
            {
              value: '',
              text: 'Todas',
            },

            {
              value: 'Insecto',
              text: 'Insecto',
            },

            {
              value: 'Hongo',
              text: 'Hongo',
            },

            {
              value: 'Bacteria',
              text: 'Bacteria',
            },

            {
              value: 'Virus',
              text: 'Virus',
            },

            {
              value: 'Ácaro',
              text: 'Ácaro',
            },
          ],
        },

        {
          id: 'filter-workflow',

          label: 'Estatus:',

          options: [
            {
              value: '',
              text: 'Todos',
            },

            {
              value: PLAGUE_WORKFLOW_STATUSES.DRAFT,
              text: 'Borrador',
            },

            {
              value: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW,
              text: 'En revisión',
            },

            {
              value: PLAGUE_WORKFLOW_STATUSES.VERIFIED,
              text: 'Verificada',
            },

            {
              value: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
              text: 'Publicada',
            },

            {
              value: PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
              text: 'Archivada',
            },
          ],
        },
      ],

      ctaLabel: 'Añadir Plaga',

      ctaIcon: 'bug_report',

      ctaBtnId: 'btn-add-plague',

      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al cargar las plagas:', error);

    return res.status(500).send('Error al cargar las plagas');
  }
};

// CREAR PLAGA

export const createPlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const validation = validatePlagueInput(req.body);

    if (!validation.isValid) {
      await transaction.rollback();
      return res.status(400).send(validation.errors.join(' '));
    }

    // ========================================================
    // CREAR REGISTRO DE PLAGA
    // ========================================================

    const plague = await Plague.create(
      {
        ...validation.value,

        workflow_status: PLAGUE_WORKFLOW_STATUSES.DRAFT,

        created_by_user_id: req.user.id,

        updated_by_user_id: req.user.id,

        status: false,
      },
      {
        transaction,
      },
    );

    // ========================================================
    // GUARDAR IMÁGENES EN PlagueImages
    // ========================================================

    if (Array.isArray(req.files) && req.files.length > 0) {
      await PlagueImage.bulkCreate(
        req.files.map((file, index) => ({
          plague_id: plague.id,
          url: `images/plagues/${file.filename}`,
          sort_order: index,
        })),
        { transaction },
      );
    }

    await AuditLog.create(
      {
        action: 'plague.create',
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: null,
        new_values: plague.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );

    // ========================================================
    // CONFIRMAR TRANSACCIÓN
    // ========================================================

    await transaction.commit();

    return res.redirect('/private/plagues');
  } catch (error) {
    // ========================================================
    // REVERTIR TRANSACCIÓN
    // ========================================================

    await transaction.rollback();

    console.error('❌ ERROR AL CREAR LA PLAGA:', error);

    return res.status(500).send('Error al crear la plaga');
  }
};

// ACTUALIZAR PLAGA

export const updatePlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    // VALIDAR ID

    if (!/^\d+$/.test(id)) {
      await transaction.rollback();

      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(Number(id), {
      transaction,
    });

    if (!plague) {
      await transaction.rollback();

      return res.status(404).send('Plaga no encontrada');
    }

    const recordPermissions = getContextualPlaguePermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: plague.created_by_user_id,
    });

    if (!recordPermissions.canEdit) {
      await transaction.rollback();
      return res
        .status(403)
        .send('Sólo el autor o un administrador puede editar esta plaga.');
    }

    if (!isPlagueEditable(plague.workflow_status)) {
      await transaction.rollback();
      return res
        .status(409)
        .send('La plaga debe estar en borrador para poder editarse.');
    }

    const oldValues = plague.toJSON();

    const validation = validatePlagueInput(req.body);

    if (!validation.isValid) {
      await transaction.rollback();
      return res.status(400).send(validation.errors.join(' '));
    }

    // ========================================================
    // ACTUALIZAR DATOS DE LA PLAGA
    // ========================================================

    await plague.update(
      {
        ...validation.value,

        updated_by_user_id: req.user.id,
      },
      {
        transaction,
      },
    );

    // ========================================================
    // SI SE SUBIERON NUEVAS IMÁGENES, SE AGREGAN A LA GALERÍA
    // ========================================================

    if (Array.isArray(req.files) && req.files.length > 0) {
      const existingImageCount = await PlagueImage.count({
        where: { plague_id: plague.id },
        transaction,
      });

      await PlagueImage.bulkCreate(
        req.files.map((file, index) => ({
          plague_id: plague.id,
          url: `images/plagues/${file.filename}`,
          sort_order: existingImageCount + index,
        })),
        { transaction },
      );
    }

    await AuditLog.create(
      {
        action: 'plague.update',
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: oldValues,
        new_values: plague.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();

    return res.redirect('/private/plagues');
  } catch (error) {
    await transaction.rollback();

    console.error('Error al actualizar la plaga:', error);

    return res.status(500).send('Error al actualizar la plaga');
  }
};

// ELIMINAR PLAGA

export const deletePlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    // ========================================================
    // VALIDAR ID
    // ========================================================

    if (!/^\d+$/.test(id)) {
      await transaction.rollback();

      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(Number(id), {
      transaction,
    });

    if (!plague) {
      await transaction.rollback();

      return res.status(404).send('Plaga no encontrada');
    }

    const oldValues = plague.toJSON();

    // ========================================================
    // ELIMINAR IMÁGENES
    // ========================================================

    await PlagueImage.destroy({
      where: {
        plague_id: plague.id,
      },

      transaction,
    });

    // ========================================================
    // ELIMINAR PLAGA
    // ========================================================

    await plague.destroy({
      transaction,
    });

    await AuditLog.create(
      {
        action: 'plague.delete',
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: oldValues,
        new_values: null,
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();

    return res.redirect('/private/plagues');
  } catch (error) {
    await transaction.rollback();

    console.error('Error al eliminar la plaga:', error);

    return res.status(500).send('Error al eliminar la plaga');
  }
};

// ACTUALIZAR WORKFLOW EDITORIAL

export const updatePlagueWorkflow = async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    return res.status(400).send('ID de plaga no válido');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const plague = await Plague.findByPk(Number(id), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!plague) {
      await transaction.rollback();
      return res.status(404).send('Plaga no encontrada');
    }

    if (
      !canPerformContextualPlagueWorkflowAction({
        role: req.user.role,
        userId: req.user.id,
        createdByUserId: plague.created_by_user_id,
        action: req.body.action,
      })
    ) {
      await transaction.rollback();
      return res
        .status(403)
        .send('No tienes permiso para realizar esta acción editorial.');
    }

    const oldValues = plague.toJSON();
    const changes = transitionPlagueWorkflow({
      currentStatus: plague.workflow_status,
      action: req.body.action,
      actor: req.user,
      reviewNotes: req.body.review_notes,
    });

    if (requiresPlagueReadiness(req.body.action)) {
      const readiness = await getWorkflowReadiness(plague, transaction);

      if (!readiness.isReady) {
        await transaction.rollback();
        return res
          .status(409)
          .send(
            `La ficha está incompleta. Completa: ${readiness.missingItems.join(', ')}.`,
          );
      }
    }

    if (req.body.action === PLAGUE_WORKFLOW_ACTIONS.VERIFY) {
      changes.verified_by =
        req.user.full_name || req.user.email || `Usuario ${req.user.id}`;
    }

    if (req.body.action === PLAGUE_WORKFLOW_ACTIONS.RESTORE) {
      changes.verified_by = null;
    }

    await plague.update(changes, { transaction });

    await AuditLog.create(
      {
        action: `plague.${req.body.action}`,
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: oldValues,
        new_values: { ...oldValues, ...changes },
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return res.redirect(`/private/plagues/${plague.id}`);
  } catch (error) {
    await transaction.rollback();

    if (error instanceof PlagueWorkflowError) {
      const status =
        error.code === 'REVIEW_NOTES_REQUIRED' || error.code === 'MISSING_ACTOR'
          ? 400
          : 409;
      return res.status(status).send(error.message);
    }

    console.error('Error al actualizar el workflow de la plaga:', error);
    return res.status(500).send('Error al actualizar el estado de la plaga');
  }
};

// ACTUALIZAR RELACIONES TÉCNICAS

export const updatePlagueRelations = async (req, res) => {
  const { id } = req.params;

  if (
    !/^\d+$/.test(id) ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0
  ) {
    return res.status(400).send('ID de plaga no válido');
  }

  const validation = validatePlagueRelationsInput(req.body);

  if (!validation.isValid) {
    return res.status(400).send(validation.errors.join(' '));
  }

  const plagueId = Number(id);
  const { productIds, cropIds, regions } = validation.value;
  const transaction = await db.sequelize.transaction();

  try {
    const plague = await Plague.findByPk(plagueId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!plague) {
      await transaction.rollback();
      return res.status(404).send('Plaga no encontrada');
    }

    const recordPermissions = getContextualPlaguePermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: plague.created_by_user_id,
    });

    if (!recordPermissions.canManageRelations) {
      await transaction.rollback();
      return res
        .status(403)
        .send(
          'Sólo el autor o un administrador puede modificar estas relaciones.',
        );
    }

    if (!isPlagueEditable(plague.workflow_status)) {
      await transaction.rollback();
      return res
        .status(409)
        .send(
          'Las relaciones solo pueden editarse en borrador o correcciones.',
        );
    }

    const missingProducts = await findMissingCatalogIds(
      Product,
      productIds,
      transaction,
    );
    if (missingProducts.length > 0) {
      await transaction.rollback();
      return res
        .status(400)
        .send(
          `No existen los productos seleccionados: ${missingProducts.join(', ')}.`,
        );
    }

    const missingCrops = await findMissingCatalogIds(
      Crop,
      cropIds,
      transaction,
    );
    if (missingCrops.length > 0) {
      await transaction.rollback();
      return res
        .status(400)
        .send(
          `No existen los cultivos seleccionados: ${missingCrops.join(', ')}.`,
        );
    }

    const regionIds = regions.map((region) => region.region_id);
    const missingRegions = await findMissingCatalogIds(
      Region,
      regionIds,
      transaction,
    );
    if (missingRegions.length > 0) {
      await transaction.rollback();
      return res
        .status(400)
        .send(
          `No existen las regiones seleccionadas: ${missingRegions.join(', ')}.`,
        );
    }

    const currentProducts = await plague.getProducts({
      attributes: ['id'],
      joinTableAttributes: [],
      transaction,
    });
    const currentCrops = await plague.getCrops({
      attributes: ['id'],
      joinTableAttributes: [],
      transaction,
    });
    const currentRegions = await PlagueRegion.findAll({
      where: { plague_id: plagueId },
      attributes: ['region_id', 'risk_level'],
      order: [['region_id', 'ASC']],
      raw: true,
      transaction,
    });

    const oldValues = {
      products: currentProducts.map(getRecordId),
      crops: currentCrops.map(getRecordId),
      regions: currentRegions.map((region) => ({
        region_id: Number(region.region_id),
        risk_level: region.risk_level,
      })),
    };
    const newValues = {
      products: productIds,
      crops: cropIds,
      regions,
    };

    await plague.setProducts(productIds, { transaction });
    await plague.setCrops(cropIds, { transaction });
    await PlagueRegion.destroy({
      where: { plague_id: plagueId },
      transaction,
    });

    if (regions.length > 0) {
      await PlagueRegion.bulkCreate(
        regions.map((region) => ({ plague_id: plagueId, ...region })),
        { transaction },
      );
    }

    await plague.update({ updated_by_user_id: req.user.id }, { transaction });
    await AuditLog.create(
      {
        action: 'plague.relations.update',
        table_name: 'PlagueRelations',
        record_id: plagueId,
        old_values: oldValues,
        new_values: newValues,
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return res.redirect(`/private/plagues/${plagueId}`);
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar las relaciones de la plaga:', error);
    return res
      .status(500)
      .send('Error al actualizar las relaciones de la plaga');
  }
};

// DETALLE DE PLAGA

export const getPlagueDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar ID
    if (!/^\d+$/.test(id)) {
      return res.status(400).send('ID de plaga no válido');
    }

    const plagueId = Number(id);

    if (!Number.isSafeInteger(plagueId) || plagueId <= 0) {
      return res.status(400).send('ID de plaga no válido');
    }

    // Buscar el expediente completo con sus relaciones técnicas.
    const plague = await Plague.findByPk(plagueId, {
      include: [
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
          include: [
            {
              model: ProductImage,
              as: 'images',
              required: false,
            },
          ],
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
      ],
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
    let relationEditor = null;

    if (canEditRelations) {
      const availableProducts = await Product.findAll({
        attributes: ['id', 'name', 'active_ingredient'],
        order: [['name', 'ASC']],
      });
      const availableCrops = await Crop.findAll({
        attributes: ['id', 'name', 'scientific_name'],
        order: [['name', 'ASC']],
      });
      const availableRegions = await Region.findAll({
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
      });

      relationEditor = buildPlagueRelationEditor({
        products: availableProducts,
        crops: availableCrops,
        regions: availableRegions,
        selectedProducts: plagueData.products,
        selectedCrops: plagueData.crops,
        selectedRegions: plagueData.regions,
      });
    }

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
