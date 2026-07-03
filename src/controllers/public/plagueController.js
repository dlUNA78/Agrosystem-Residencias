import db from "../../models/index.js";
const { Plague, PlagueImage, Product } = db;

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

// ── GET /plagues ───────────────────────────────────────────────────────────
export const renderPlaguesPublic = async (req, res) => {
  try {
    const plaguesRaw = await Plague.findAll({
      where: { status: true },
      order: [["createdAt", "DESC"]],
    });

    const plagues = plaguesRaw.map((p) => {
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

    res.render("public/plagues", {
      pageTitle: "Plagas",
      activePage: "plagues",
      plagues,
      totalCount: plagues.length,
    });
  } catch (error) {
    console.error("Error en renderPlaguesPublic:", error);
    res.status(500).render("public/plagues", {
      pageTitle: "Plagas",
      activePage: "plagues",
      plagues: [],
      totalCount: 0,
      error: "No se pudieron cargar las plagas en este momento.",
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
          required: false, // LEFT JOIN — no falla si no hay productos relacionados
          attributes: ["id", "name", "active_ingredient", "manufacturer", "image_url", "category", "validation_status"],
        },
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
      },
      carouselImages,
      relatedProducts,
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
