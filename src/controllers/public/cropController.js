import db from "../../models/index.js";
import { Op } from "sequelize";

const { Crop, CropImage } = db;

// ── GET /crops — Catálogo Público de Cultivos ──────────────────────────────
export const renderCropsPublic = async (req, res) => {
  try {
    const { search, category, page = 1 } = req.query;
    const limit = 8;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    const where = { status: "aprobado" };

    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { scientific_name: { [Op.iLike]: `%${search.trim()}%` } },
        { description: { [Op.iLike]: `%${search.trim()}%` } },
        { family: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (category && category !== "Categoría" && category !== "Todas") {
      where.category = category;
    }

    const { count, rows } = await Crop.findAndCountAll({
      where,
      include: [
        {
          model: CropImage,
          as: "images",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const crops = rows.map((cropItem) => {
      const c = cropItem.toJSON();
      const primaryImg = c.images?.find((i) => i.is_primary) || c.images?.[0];

      return {
        id: c.id,
        name: c.name,
        scientificName: c.scientific_name,
        category: c.category || "General",
        family: c.family,
        description: c.description,
        image_url: primaryImg ? primaryImg.image_url : null,
        climate: c.climate,
        season: c.season,
        harvest_days: c.harvest_days,
        soil_type: c.soil_type,
        water_requirement: c.water_requirement,
      };
    });

    const totalPages = Math.ceil(count / limit) || 1;

    res.render("public/crops", {
      pageTitle: "Catálogo de Cultivos",
      activePage: "crops",
      crops,
      totalCount: count,
      totalPages,
      currentPage,
      hasMultiplePages: totalPages > 1,
      hasPrevPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
      prevPage: currentPage - 1,
      nextPage: currentPage + 1,
      search: search || "",
      selectedCategory: category || "",
    });
  } catch (error) {
    console.error("Error en renderCropsPublic:", error);
    res.render("public/crops", {
      pageTitle: "Catálogo de Cultivos",
      activePage: "crops",
      crops: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: 1,
      error: "Error al cargar los cultivos",
    });
  }
};

// ── GET /crops/:id — Detalle Público del Cultivo ───────────────────────────
export const renderCropDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const cropRecord = await Crop.findByPk(id, {
      include: [
        {
          model: CropImage,
          as: "images",
          order: [
            ["is_primary", "DESC"],
            ["display_order", "ASC"],
          ],
        },
      ],
    });

    if (!cropRecord || cropRecord.status !== "aprobado") {
      return res.status(404).render("public/crops", {
        pageTitle: "Cultivo No Encontrado",
        activePage: "crops",
        error: "El cultivo solicitado no existe o no se encuentra disponible.",
        crops: [],
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
      });
    }

    const crop = cropRecord.toJSON();
    const primaryImg = crop.images?.find((i) => i.is_primary) || crop.images?.[0];

    res.render("public/crop-detail", {
      pageTitle: crop.name,
      activePage: "crops",
      crop,
      primaryImage: primaryImg ? primaryImg.image_url : null,
      carouselImages: crop.images || [],
    });
  } catch (error) {
    console.error("Error en renderCropDetail:", error);
    res.status(500).send("Error al cargar la información del cultivo");
  }
};