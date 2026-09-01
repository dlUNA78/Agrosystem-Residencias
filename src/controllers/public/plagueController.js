import db from '../../models/index.js';
import { Op } from 'sequelize';
import { buildPlagueDetailView } from '../../services/plagueDetailService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../services/plagueWorkflowService.js';

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

// ── GET /api/plagues ───────────────────────────────────────────────────────
export const getPlaguesData = async (req, res) => {
  try {
    const {
      search,
      category,
      region,
      risk,
      page = 1,
      limit: customLimit,
    } = req.query;
    const limit = parseInt(customLimit, 10) || 8;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    const where = {
      status: true,
      workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { scientific_name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (category && category !== 'Categoría') {
      where.category = category;
    }

    let includeModels = [];

    if (region && region !== 'Región') {
      includeModels.push({
        model: Region,
        as: 'regions',
        where: { name: region },
        required: true,
      });
    }

    if (risk && risk !== 'Riesgo') {
      // Map risk back from UI selection to DB value if needed, or assume exact match
      // The DB values are Alto, Medio, Bajo. The UI options are Crítico, Moderado, Bajo
      const riskMapping = {
        Crítico: 'Alto',
        Moderado: 'Medio',
        Bajo: 'Bajo',
      };
      if (riskMapping[risk]) {
        where.risk_level = riskMapping[risk];
      }
    }

    const { count, rows } = await Plague.findAndCountAll({
      where: where,
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
      limit,
      offset: offset,
      distinct: true,
    });

    const plagues = rows.map((p) => {
      const risk = riskMap[p.risk_level] || defaultRisk;
      const firstImage = p.images?.[0];
      const imgUrl =
        p.image_url || firstImage?.url || '/images/test/default.png';

      return {
        id: p.id,
        name: p.name,
        scientificName: p.scientific_name,
        category: p.category,
        description: p.description,

        image_url: imgUrl,
        imageUrl: imgUrl,

        riskLabel: risk.label,
        riskBadgeClass: risk.badgeClass,
      };
    });
    res.json({
      plagues,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Error en getPlaguesData:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── GET /plagues ───────────────────────────────────────────────────────────
export const renderPlaguesPublic = async (req, res) => {
  try {
    const limit = 8;

    const { count, rows } = await Plague.findAndCountAll({
      where: {
        status: true,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
      },

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
      limit,
      offset: 0,
      distinct: true,
    });

    const regionsDB = await Region.findAll({
      attributes: ['name'],
      order: [['name', 'ASC']],
    });

    const regionNames = regionsDB.map((r) => r.name);

    const plagues = rows.map((p) => {
      const risk = riskMap[p.risk_level] || defaultRisk;
      const firstImage = p.images?.[0];
      const imgUrl =
        p.image_url || firstImage?.url || '/images/test/default.png';

      return {
        id: p.id,
        name: p.name,
        scientificName: p.scientific_name,
        category: p.category,
        description: p.description,

        image_url: imgUrl,
        imageUrl: imgUrl,

        riskLabel: risk.label,
        riskBadgeClass: risk.badgeClass,
      };
    });

    const totalPages = Math.ceil(count / limit);

    res.render('public/plagues', {
      pageTitle: 'Plagas',
      activePage: 'plagues',
      plagues,
      regions: regionNames,
      totalCount: count,
      totalPages,
      currentPage: 1,
      extraScripts: '<script src="/js/public/plagues.js"></script>',
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
      extraScripts: '<script src="/js/public/plagues.js"></script>',
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
          where: { status: true },
          required: false, // LEFT JOIN
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
        totalCount: 0,
        totalPages: 0,
        currentPage: 1,
        error: 'La plaga que buscas no existe o no está disponible.',
        extraScripts: '<script src="/js/public/plagues.js"></script>',
      });
    }

    const detail = buildPlagueDetailView(plague.toJSON());

    res.render('shared/plague-detail', {
      layout: 'public',
      pageTitle: plague.name,
      activePage: 'plagues',
      isPrivate: false,
      ...detail,
      extraScripts: '<script src="/js/shared/plague-detail.js"></script>',
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
