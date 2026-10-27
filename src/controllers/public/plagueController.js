import db from '../../models/index.js';
import { Op } from 'sequelize';
import { buildPlagueDetailView } from '../../services/plagueDetailService.js';
import { sendPlaguePdfResponse } from '../../services/plaguePdfService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../services/plagueWorkflowService.js';
import { PRODUCT_WORKFLOW_STATUSES } from '../../services/productWorkflowService.js';
import {
  buildPublishedPlagueQuery,
  buildPublicPlaguePageUrl,
  normalizePublicPlagueQuery,
} from '../../services/plaguePublicQueryService.js';

const { Plague, PlagueImage, Product, Region, Crop } = db;

// ── Mapeo de riesgo (compartido entre ambas funciones) ─────────────────────
const riskMap = {
  Alto: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    gradientClass: 'bg-linear-to-br from-error-container to-error',
    alertBgClass: 'bg-rose-50 border-rose-200 text-rose-950',
    alertIcon: 'warning',
    alertIconClass: 'text-rose-600',
    alertBarClass: 'bg-rose-600 w-[85%]',
    alertText:
      'Requiere monitoreo y acción inmediata en zonas hortícolas y cerealeras.',
    kpiTextClass: 'text-rose-600',
    bannerClass: 'bg-rose-50 border-rose-200',
    bannerTagClass: 'text-rose-700',
    bannerTextClass: 'text-rose-950',
  },
  Medio: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    gradientClass: 'bg-linear-to-br from-primary-container to-primary',
    alertBgClass: 'bg-amber-50 border-amber-200 text-amber-950',
    alertIcon: 'warning_amber',
    alertIconClass: 'text-amber-600',
    alertBarClass: 'bg-amber-500 w-[50%]',
    alertText:
      'Requiere monitoreo continuo y control fitosanitario preventivo.',
    kpiTextClass: 'text-amber-600',
    bannerClass: 'bg-amber-50 border-amber-200',
    bannerTagClass: 'text-amber-700',
    bannerTextClass: 'text-amber-950',
  },
};
const defaultRisk = {
  label: 'Bajo',
  badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  gradientClass: 'bg-surface-container-high',
  alertBgClass: 'bg-emerald-50 border-emerald-200 text-emerald-950',
  alertIcon: 'check_circle',
  alertIconClass: 'text-emerald-600',
  alertBarClass: 'bg-emerald-500 w-[20%]',
  alertText:
    'Bajo impacto fitosanitario. Mantener vigilancia preventiva estándar.',
  kpiTextClass: 'text-emerald-600',
  bannerClass: 'bg-emerald-50 border-emerald-200',
  bannerTagClass: 'text-emerald-700',
  bannerTextClass: 'text-emerald-950',
};

const buildPublicPlagueCard = (record, cropNamesByPlagueId = new Map()) => {
  const plague = typeof record.toJSON === 'function' ? record.toJSON() : record;
  const normalizedRiskLevel =
    { Crítico: 'Alto', Moderado: 'Medio' }[plague.risk_level] ||
    plague.risk_level;
  const risk = riskMap[normalizedRiskLevel] || defaultRisk;
  const firstImage = plague.images?.[0];
  const imageUrl =
    plague.image_url || firstImage?.url || '/images/test/default.png';
  const hostCrops =
    cropNamesByPlagueId.get(plague.id) ||
    (Array.isArray(plague.crops)
      ? plague.crops.map((c) => c.name).filter(Boolean)
      : []);

  return {
    id: plague.id,
    name: plague.name,
    scientificName: plague.scientific_name,
    category: plague.category,
    description: plague.description,
    image_url: imageUrl,
    imageUrl,
    riskLabel: risk.label,
    riskBadgeClass: risk.badgeClass,
    hostCrops: hostCrops.slice(0, 3),
    extraHostCropsCount: Math.max(0, hostCrops.length - 3),
  };
};

const loadCropNamesByPlagueId = async (rows) => {
  const ids = rows.map((row) => row.id).filter(Boolean);
  if (ids.length === 0 || typeof Plague.findAll !== 'function') {
    return new Map();
  }

  const withCrops = await Plague.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ['id'],
    include: [
      {
        model: Crop,
        as: 'crops',
        attributes: ['name'],
        through: { attributes: [] },
        required: false,
      },
    ],
  });

  const map = new Map();
  withCrops.forEach((record) => {
    const plain =
      typeof record.toJSON === 'function' ? record.toJSON() : record;
    const names = Array.isArray(plain.crops)
      ? plain.crops.map((crop) => crop.name).filter(Boolean)
      : [];
    map.set(plain.id, names);
  });
  return map;
};

const findPublishedPlagues = async (rawQuery = {}) => {
  const query = normalizePublicPlagueQuery(rawQuery);
  const filters = buildPublishedPlagueQuery({
    Op,
    query,
    Region,
    Crop,
    PlagueImage,
  });
  const { count, rows } = await Plague.findAndCountAll({
    ...filters,
    order: [['createdAt', 'DESC']],
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
    distinct: true,
  });
  const totalPages = Math.max(1, Math.ceil(count / query.limit));
  const currentPage = Math.min(query.page, totalPages);

  let activeRows = rows;
  let activeCount = count;

  if (currentPage !== query.page && count > 0) {
    const corrected = await Plague.findAndCountAll({
      ...filters,
      order: [['createdAt', 'DESC']],
      limit: query.limit,
      offset: (currentPage - 1) * query.limit,
      distinct: true,
    });
    activeRows = corrected.rows;
    activeCount = corrected.count;
  }

  const cropNamesByPlagueId = await loadCropNamesByPlagueId(activeRows);

  return {
    plagues: activeRows.map((row) =>
      buildPublicPlagueCard(row, cropNamesByPlagueId),
    ),
    totalCount: activeCount,
    totalPages,
    currentPage,
    query: { ...query, page: currentPage },
  };
};

const loadSimilarPublishedPlagues = async (plaguePlain) => {
  if (typeof Plague.findAll !== 'function') return [];
  const cropIds = Array.isArray(plaguePlain.crops)
    ? plaguePlain.crops.map((c) => c.id).filter(Boolean)
    : [];

  const baseWhere = {
    id: { [Op.ne]: plaguePlain.id },
    status: true,
    workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
  };

  let candidates = [];
  if (cropIds.length > 0) {
    candidates = await Plague.findAll({
      where: baseWhere,
      include: [
        {
          model: PlagueImage,
          as: 'images',
          required: false,
          separate: true,
          order: [['sort_order', 'ASC']],
        },
        {
          model: Crop,
          as: 'crops',
          attributes: ['id', 'name'],
          through: { attributes: [] },
          where: { id: { [Op.in]: cropIds } },
          required: true,
        },
      ],
      limit: 4,
      order: [['createdAt', 'DESC']],
    });
  }

  if (candidates.length === 0 && plaguePlain.category) {
    candidates = await Plague.findAll({
      where: { ...baseWhere, category: plaguePlain.category },
      include: [
        {
          model: PlagueImage,
          as: 'images',
          required: false,
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],
      limit: 4,
      order: [['createdAt', 'DESC']],
    });
  }

  const cropMap = await loadCropNamesByPlagueId(candidates);
  return candidates.map((row) => buildPublicPlagueCard(row, cropMap));
};

// ── GET /api/plagues ───────────────────────────────────────────────────────
export const getPlaguesData = async (req, res) => {
  try {
    const result = await findPublishedPlagues(req.query);
    return res.json({
      plagues: result.plagues,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    });
  } catch (error) {
    console.error('Error en getPlaguesData:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── GET /plagues ───────────────────────────────────────────────────────────
export const renderPlaguesPublic = async (req, res) => {
  try {
    const [result, regionsDB, cropsDB] = await Promise.all([
      findPublishedPlagues(req.query),
      Region.findAll({
        attributes: ['name'],
        order: [['name', 'ASC']],
      }),
      Crop.findAll({
        attributes: ['name'],
        order: [['name', 'ASC']],
      }),
    ]);

    const regionNames = regionsDB.map((r) => r.name);
    const cropNames = [...new Set(cropsDB.map((c) => c.name).filter(Boolean))];

    res.render('public/plagues', {
      pageTitle: 'Plagas',
      activePage: 'plagues',
      plagues: result.plagues,
      regions: regionNames,
      crops: cropNames,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMultiplePages: result.totalPages > 1,
      hasPrevPage: result.currentPage > 1,
      hasNextPage: result.currentPage < result.totalPages,
      prevUrl: buildPublicPlaguePageUrl(result.currentPage - 1, result.query),
      nextUrl: buildPublicPlaguePageUrl(result.currentPage + 1, result.query),
      filters: result.query,
      extraScripts: '<script src="/js/public/plagues.js?v=2.7"></script>',
    });
  } catch (error) {
    console.error('Error en renderPlaguesPublic:', error);

    res.status(500).render('public/plagues', {
      pageTitle: 'Plagas',
      activePage: 'plagues',
      plagues: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      error: 'No se pudieron cargar las plagas en este momento.',
      extraScripts: '<script src="/js/public/plagues.js?v=2.7"></script>',
    });
  }
};

// ── GET /plagues/:id ───────────────────────────────────────────────────────
export const renderPlagueDetail = async (req, res) => {
  try {
    const plague = await Plague.findOne({
      where: {
        id: req.params.id,
        status: true,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
      },
      include: [
        {
          model: PlagueImage,
          as: 'images',
        },
        {
          model: Product,
          as: 'products',
          where: {
            status: true,
            workflow_status: PRODUCT_WORKFLOW_STATUSES.PUBLISHED,
          },
          required: false,
          attributes: [
            'id',
            'name',
            'active_ingredient',
            'manufacturer',
            'category',
            'validation_status',
          ],
          include: [
            {
              model: db.ProductImage,
              as: 'images',
              required: false,
            },
          ],
        },
        {
          model: Region,
          as: 'regions',
          through: { attributes: ['risk_level'] },
        },
        {
          model: Crop,
          as: 'crops',
          through: { attributes: [] },
        },
      ],
    });

    if (!plague) {
      return res.status(404).render('public/plagues', {
        pageTitle: 'Plaga no encontrada',
        activePage: 'plagues',
        plagues: [],
        regions: [],
        crops: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        error: 'La plaga que buscas no existe o no está disponible.',
        extraScripts: '<script src="/js/public/plagues.js?v=2.7"></script>',
      });
    }

    const plainPlague = plague.toJSON();
    const detail = buildPlagueDetailView(plainPlague);
    if (req.query?.format === 'pdf') {
      return sendPlaguePdfResponse(res, detail, {
        download: req.query.download === '1',
        isPrivate: false,
      });
    }
    const similarPlagues = await loadSimilarPublishedPlagues(plainPlague);

    res.render('shared/plague-detail', {
      layout: 'public',
      pageTitle: plague.name,
      activePage: 'plagues',
      isPrivate: false,
      similarPlagues,
      ...detail,
      extraScripts:
        '<script type="module" src="/js/shared/plague-detail.js?v=2.8"></script>',
    });
  } catch (error) {
    console.log('=== CATCH ERROR IN RENDER PLAGUE DETAIL ===');
    console.log(error.message);
    console.log(error.stack);
    res.status(500).render('public/plagues', {
      pageTitle: 'Error',
      activePage: 'plagues',
      plagues: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      error: 'Error al cargar la plaga. Intenta de nuevo.',
    });
  }
};
