import db from "../../models/index.js";
import { Op } from "sequelize";
const { Plague, PlagueImage, Product, Region } = db;

// ── Mapeo de riesgo (compartido entre ambas funciones) ─────────────────────
const riskMap = {
  Alto: {
    label: "Crítico",
    badgeClass: "bg-error-container text-on-error-container",
    gradientClass: "bg-linear-to-br from-error-container to-error",
  },
  Medio: {
    label: "Moderado",
    badgeClass: "bg-primary-container text-on-primary-container",
    gradientClass: "bg-linear-to-br from-primary-container to-primary",
  },
};
const defaultRisk = {
  label: "Bajo",
  badgeClass: "bg-surface-container-highest text-on-surface-variant",
  gradientClass: "bg-surface-container-high",
};

// Pasos genéricos de ciclo biológico (fallback si la BD no tiene datos)
const defaultCycle = [
  { title: "Huevo / Fundación",   description: "Fase inicial de desarrollo. En climas fríos el organismo pasa el invierno en forma de huevo o estructuras de resistencia." },
  { title: "Estadio Juvenil",     description: "Crecimiento activo y alimentación intensa. El organismo pasa por múltiples instares o mudas antes de alcanzar la madurez." },
  { title: "Adulto Reproductivo", description: "Etapa de reproducción masiva. En condiciones óptimas la población puede multiplicarse exponencialmente en días." },
  { title: "Dispersión",          description: "Formas migratorias o resistentes que permiten la colonización de nuevos hospedantes cuando el recurso actual se agota." },
];

// ── GET /api/plagues ───────────────────────────────────────────────────────
export const getPlaguesData = async (req, res) => {
  try {
    const { search, category, region, risk, page = 1 } = req.query;
    const limit = 8;
    const offset = (page - 1) * limit;

    const where = { status: true };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { scientific_name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (category && category !== "Categoría") {
      where.category = category;
    }

    let includeModels = [];

    if (region && region !== "Región") {
      includeModels.push({
        model: Region,
        as: "regions",
        where: { name: region },
        required: true
      });
    }

    if (risk && risk !== "Riesgo") {
      // Map risk back from UI selection to DB value if needed, or assume exact match
      // The DB values are Alto, Medio, Bajo. The UI options are Crítico, Moderado, Bajo
      const riskMapping = {
        "Crítico": "Alto",
        "Moderado": "Medio",
        "Bajo": "Bajo"
      };
      if (riskMapping[risk]) {
        where.risk_level = riskMapping[risk];
      }
    }

    const { count, rows } = await Plague.findAndCountAll({
      where,
      include: includeModels,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true
    });

    const plagues = rows.map((p) => {
      const riskObj = riskMap[p.risk_level] || defaultRisk;
      return {
        id: p.id,
        name: p.name,
        scientificName: p.scientific_name,
        category: p.category,
        description: p.description,
        imageUrl: p.image_url,
        riskLabel: riskObj.label,
        riskBadgeClass: riskObj.badgeClass,
      };
    });

    res.json({
      plagues,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error en getPlaguesData:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ── GET /plagues ───────────────────────────────────────────────────────────
export const renderPlaguesPublic = async (req, res) => {
  try {
    const limit = 8;
    const { count, rows } = await Plague.findAndCountAll({
      where: { status: true },
      order: [["createdAt", "DESC"]],
      limit,
      offset: 0,
      distinct: true
    });

    const regionsDB = await Region.findAll({ attributes: ['name'], order: [['name', 'ASC']] });
    const regionNames = regionsDB.map(r => r.name);

    const plagues = rows.map((p) => {
      const risk = riskMap[p.risk_level] || defaultRisk;
      return {
        id: p.id,
        name: p.name,
        scientificName: p.scientific_name,
        category: p.category,
        description: p.description,
        imageUrl: p.image_url,
        riskLabel: risk.label,
        riskBadgeClass: risk.badgeClass,
      };
    });

    const totalPages = Math.ceil(count / limit);

    res.render("public/plagues", {
      pageTitle: "Plagas",
      activePage: "plagues",
      plagues,
      regions: regionNames,
      totalCount: count,
      totalPages,
      currentPage: 1,
      extraScripts: '<script src="/js/public/plagues.js"></script>',
    });
  } catch (error) {
    console.error("Error en renderPlaguesPublic:", error);
    res.status(500).render("public/plagues", {
      pageTitle: "Plagas",
      activePage: "plagues",
      plagues: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      error: "No se pudieron cargar las plagas en este momento.",
      extraScripts: '<script src="/js/public/plagues.js"></script>',
    });
  }
};

// ── GET /plagues/:id ───────────────────────────────────────────────────────
export const renderPlagueDetail = async (req, res) => {
  try {
    const plague = await Plague.findOne({
      where: { id: req.params.id, status: true },
      include: [
        {
          model: PlagueImage,
          as: "images",
        },
        {
          model: Product,
          as: "products",
          where: { status: true },
          required: false, // LEFT JOIN
          attributes: ["id", "name", "active_ingredient", "manufacturer", "image_url", "category", "validation_status"],
        },
        {
          model: Region,
          as: "regions",
          through: { attributes: ['risk_level'] }
        }
      ],
    });

    if (!plague) {
      return res.status(404).render("shared/plague-detail", {
        layout: "public",
        pageTitle: "Plaga no encontrada",
        activePage: "plagues",
        isPrivate: false,
        plague: null,
        error: "La plaga que buscas no existe o no está disponible.",
      });
    }

    const risk = riskMap[plague.risk_level] || defaultRisk;

    // Ciclo biológico: datos de BD o fallback genérico
    const biologicalCycle =
      Array.isArray(plague.biological_cycle) && plague.biological_cycle.length
        ? plague.biological_cycle
        : defaultCycle;

    // Imágenes del carrusel ordenadas por sort_order
    const carouselImages = (plague.images || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        url:     img.url,
        caption: img.caption || plague.name,
        source:  img.source  || "Banco de Germoplasma INIFAP",
      }));

    // Productos relacionados
    const relatedProducts = (plague.products || []).map((p) => ({
      id:               p.id,
      name:             p.name,
      activeIngredient: p.active_ingredient,
      manufacturer:     p.manufacturer,
      imageUrl:         p.image_url,
      category:         p.category,
      isValidated:      p.validation_status === "Validado",
    }));

    // Regiones de incidencia con coordenadas para el mapa (desde BD)
    let incidenceRegions = (plague.regions || []).map((region) => {
      const specificRiskLevel = region.PlagueRegions?.dataValues?.risk_level || region.PlagueRegions?.risk_level || plague.risk_level;
      const specificRisk = riskMap[specificRiskLevel] || defaultRisk;

      return {
        name: region.name,
        lat: region.lat,
        lng: region.lng,
        hasCoords: true,
        riskLevel: specificRiskLevel,
        riskLabel: specificRisk.label,
        riskBadgeClass: specificRisk.badgeClass
      };
    });

    // Ordenamiento: Alto, Medio, Bajo
    const riskSortOrder = { "Alto": 1, "Medio": 2, "Bajo": 3 };
    incidenceRegions.sort((a, b) => {
      const orderA = riskSortOrder[a.riskLevel] || 4;
      const orderB = riskSortOrder[b.riskLevel] || 4;
      return orderA - orderB;
    });

    res.render("shared/plague-detail", {
      layout: "public",
      pageTitle: plague.name,
      activePage: "plagues",
      isPrivate: false,
      plague: {
        id:                plague.id,
        name:              plague.name,
        scientificName:    plague.scientific_name,
        category:          plague.category,
        description:       plague.description,
        imageUrl:          plague.image_url,
        symptoms:          plague.symptoms,
        controlMethods:    plague.control_methods,
        biologicalControl: plague.biological_control,
        biologicalCycle,
        region:            plague.region,
        riskLabel:         risk.label,
        riskBadgeClass:    risk.badgeClass,
        riskGradientClass: risk.gradientClass,
        riskLevel:         plague.risk_level,
        verifiedBy:        plague.verified_by || null,
        verifiedAt:        plague.verified_at
          ? new Date(plague.verified_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
          : null,
      },
      carouselImages,
      relatedProducts,
      incidenceRegions,
      incidenceRegionsJson: JSON.stringify(incidenceRegions),
      extraHead: '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>',
      extraScripts: '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script><script src="/js/public/plague-detail.js"></script>',
    });
  } catch (error) {
    console.error("Error en renderPlagueDetail:", error);
    res.status(500).render("shared/plague-detail", {
      layout: "public",
      pageTitle: "Error",
      activePage: "plagues",
      isPrivate: false,
      plague: null,
      error: "Error al cargar la plaga. Intenta de nuevo.",
    });
  }
};
