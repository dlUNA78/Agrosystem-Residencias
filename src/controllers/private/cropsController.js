import path from "path";
import { fileURLToPath } from "url";
import db from "../../models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateLayout = path.join(__dirname, "../../views/layouts/private");

// ============================================================
// GET /private/crops — Listado de cultivos con filtros
// ============================================================
export const cropsPrivate = async (req, res) => {
  try {
    const { search = "", category = "", status = "" } = req.query;
    const { Op } = db.Sequelize;

    const where = {};

    if (search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { scientific_name: { [Op.iLike]: `%${search.trim()}%` } },
        { category: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const crops = await db.Crop.findAll({
      where,
      include: [
        {
          model: db.CropImage,
          as: "images",
          required: false,
          separate: true,
          order: [
            ["is_primary", "DESC"],
            ["display_order", "ASC"],
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const cropsFormatted = crops.map((crop) => {
      const cropData = crop.toJSON();
      const primaryImage = cropData.images?.find((img) => img.is_primary === true);
      const firstImage = primaryImage || cropData.images?.[0];

      return {
        ...cropData,
        image_url: firstImage ? firstImage.image_url : null,
        images: cropData.images || [],
      };
    });

    return res.render("private/catalog/crops", {
      layout: privateLayout,
      pageTitle: "Cultivos",
      activePage: "crops",
      crops: cropsFormatted,
      searchId: "crop-search",
      searchPlaceholder: "Buscar por nombre, especie o tipo de cultivo...",
      searchFilters: [
        {
          id: "filter-type",
          param: "category",
          label: "Tipo:",
          options: [
            { value: "", text: "Todos" },
            { value: "cereal", text: "Cereal" },
            { value: "frutal", text: "Frutal" },
            { value: "hortaliza", text: "Hortaliza" },
            { value: "leguminosa", text: "Leguminosa" },
            { value: "oleaginosa", text: "Oleaginosa" },
            { value: "tuberculo", text: "Tubérculo" },
            { value: "forrajera", text: "Forrajera" },
            { value: "ornamental", text: "Ornamental" },
            { value: "industrial", text: "Industrial" },
            { value: "otro", text: "Otro" },
          ],
        },
        {
          id: "filter-status",
          param: "status",
          label: "Estatus:",
          options: [
            { value: "", text: "Todos" },
            { value: "aprobado", text: "Aprobado" },
            { value: "pendiente", text: "Pendiente" },
            { value: "rechazado", text: "Rechazado" },
          ],
        },
      ],
      ctaLabel: "Añadir Cultivo",
      ctaIcon: "agriculture",
      ctaBtnId: "btn-add-crop",
      showViewToggle: true,
    });
  } catch (error) {
    console.error("Error al cargar los cultivos:", error);
    return res.status(500).send("Error al cargar los cultivos");
  }
};

// Alias por consistencia
export const renderCropsPrivate = cropsPrivate;

// ============================================================
// GET /private/crops/:id — Detalle del cultivo
// ============================================================
export const getCropDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const crop = await db.Crop.findByPk(id, {
      include: [
        {
          model: db.CropImage,
          as: "images",
          attributes: ["id", "image_url", "original_name", "is_primary", "display_order"],
          required: false,
        },
        {
          model: db.Plague,
          as: "plagues",
          required: false,
        },
        {
          model: db.Farm,
          as: "farms",
          required: false,
        },
        {
          model: db.Product,
          as: "products",
          required: false,
        },
      ],
    });

    if (!crop) {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(404).json({ success: false, message: "Cultivo no encontrado" });
      }
      return res.status(404).send("Cultivo no encontrado");
    }

    if (req.xhr || (req.headers.accept && req.headers.accept.includes("json") && !req.headers.accept.includes("text/html"))) {
      return res.json({ success: true, crop });
    }

    const cropData = crop.toJSON();
    const primaryImage = cropData.images?.find((img) => img.is_primary) || cropData.images?.[0];

    return res.render("private/catalog/crop-detail", {
      layout: privateLayout,
      pageTitle: cropData.name,
      activePage: "crops",
      crop: cropData,
      primaryImage: primaryImage ? primaryImage.image_url : null,
      carouselImages: cropData.images || [],
    });
  } catch (error) {
    console.error("ERROR AL OBTENER CULTIVO:", error);
    if (req.xhr || req.headers.accept?.includes("json")) {
      return res.status(500).json({ success: false, message: "Error al obtener el cultivo", error: error.message });
    }
    return res.status(500).send("Error al obtener el cultivo");
  }
};

// ============================================================
// POST /private/crops/create — Crear nuevo cultivo
// ============================================================
export const createCrop = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      name,
      scientific_name,
      category,
      family,
      genus,
      variety,
      region,
      state,
      min_altitude,
      max_altitude,
      climate,
      min_temperature,
      max_temperature,
      min_rainfall,
      max_rainfall,
      humidity,
      soil_type,
      ph_range,
      drainage,
      organic_matter,
      season,
      cycle,
      harvest_days,
      average_yield,
      planting_density,
      planting_depth,
      water_requirement,
      irrigation_type,
      sunlight_requirement,
      nutrients,
      fertilization,
      requires_pruning,
      pollination_type,
      description,
      observations,
      status,
    } = req.body;

    if (!name || !name.trim()) {
      await transaction.rollback();
      return res.status(400).send("El nombre del cultivo es obligatorio");
    }

    const crop = await db.Crop.create(
      {
        name: name.trim(),
        scientific_name: scientific_name ? scientific_name.trim() : "",
        category: category || "otro",
        family: family?.trim() || null,
        genus: genus?.trim() || null,
        variety: variety?.trim() || null,
        region: region?.trim() || null,
        state: state?.trim() || null,
        min_altitude: min_altitude ? Number(min_altitude) : null,
        max_altitude: max_altitude ? Number(max_altitude) : null,
        climate: climate?.trim() || null,
        min_temperature: min_temperature ? Number(min_temperature) : null,
        max_temperature: max_temperature ? Number(max_temperature) : null,
        min_rainfall: min_rainfall ? Number(min_rainfall) : null,
        max_rainfall: max_rainfall ? Number(max_rainfall) : null,
        humidity: humidity?.trim() || null,
        soil_type: soil_type?.trim() || null,
        ph_range: ph_range?.trim() || null,
        drainage: drainage?.trim() || null,
        organic_matter: organic_matter?.trim() || null,
        season: season?.trim() || null,
        cycle: cycle?.trim() || null,
        harvest_days: harvest_days ? Number(harvest_days) : null,
        average_yield: average_yield?.trim() || null,
        planting_density: planting_density?.trim() || null,
        planting_depth: planting_depth?.trim() || null,
        water_requirement: water_requirement?.trim() || null,
        irrigation_type: irrigation_type?.trim() || null,
        sunlight_requirement: sunlight_requirement?.trim() || null,
        nutrients: nutrients?.trim() || null,
        fertilization: fertilization?.trim() || null,
        requires_pruning:
          requires_pruning === "true"
            ? true
            : requires_pruning === "false"
              ? false
              : null,
        pollination_type: pollination_type?.trim() || null,
        description: description?.trim() || null,
        observations: observations?.trim() || null,
        status: status || "pendiente",
      },
      { transaction }
    );

    if (req.files && req.files.length > 0) {
      const images = req.files.map((file, index) => ({
        crop_id: crop.id,
        image_url: `images/crops/${file.filename}`,
        original_name: file.originalname,
        is_primary: index === 0,
        display_order: index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.CropImage.bulkCreate(images, { transaction });
    }

    await transaction.commit();
    return res.redirect("/private/crops");
  } catch (error) {
    await transaction.rollback();
    console.error("ERROR AL CREAR CULTIVO:", error);
    return res.status(500).json({
      success: false,
      message: "Error al crear el cultivo",
      error: error.message,
    });
  }
};

// ============================================================
// POST /private/crops/update/:id — Actualizar cultivo
// ============================================================
export const updateCrop = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      name,
      scientific_name,
      category,
      family,
      genus,
      variety,
      region,
      state,
      min_altitude,
      max_altitude,
      climate,
      min_temperature,
      max_temperature,
      min_rainfall,
      max_rainfall,
      humidity,
      soil_type,
      ph_range,
      drainage,
      organic_matter,
      season,
      cycle,
      harvest_days,
      average_yield,
      planting_density,
      planting_depth,
      water_requirement,
      irrigation_type,
      sunlight_requirement,
      nutrients,
      fertilization,
      requires_pruning,
      pollination_type,
      description,
      observations,
      status,
    } = req.body;

    const crop = await db.Crop.findByPk(id, { transaction });

    if (!crop) {
      await transaction.rollback();
      return res.status(404).send("Cultivo no encontrado");
    }

    await crop.update(
      {
        name: name ? name.trim() : crop.name,
        scientific_name: scientific_name !== undefined ? scientific_name.trim() : crop.scientific_name,
        category: category || crop.category,
        family: family?.trim() || null,
        genus: genus?.trim() || null,
        variety: variety?.trim() || null,
        region: region?.trim() || null,
        state: state?.trim() || null,
        min_altitude: min_altitude ? Number(min_altitude) : null,
        max_altitude: max_altitude ? Number(max_altitude) : null,
        climate: climate?.trim() || null,
        min_temperature: min_temperature ? Number(min_temperature) : null,
        max_temperature: max_temperature ? Number(max_temperature) : null,
        min_rainfall: min_rainfall ? Number(min_rainfall) : null,
        max_rainfall: max_rainfall ? Number(max_rainfall) : null,
        humidity: humidity?.trim() || null,
        soil_type: soil_type?.trim() || null,
        ph_range: ph_range?.trim() || null,
        drainage: drainage?.trim() || null,
        organic_matter: organic_matter?.trim() || null,
        season: season?.trim() || null,
        cycle: cycle?.trim() || null,
        harvest_days: harvest_days ? Number(harvest_days) : null,
        average_yield: average_yield?.trim() || null,
        planting_density: planting_density?.trim() || null,
        planting_depth: planting_depth?.trim() || null,
        water_requirement: water_requirement?.trim() || null,
        irrigation_type: irrigation_type?.trim() || null,
        sunlight_requirement: sunlight_requirement?.trim() || null,
        nutrients: nutrients?.trim() || null,
        fertilization: fertilization?.trim() || null,
        requires_pruning:
          requires_pruning === "true"
            ? true
            : requires_pruning === "false"
              ? false
              : null,
        pollination_type: pollination_type?.trim() || null,
        description: description?.trim() || null,
        observations: observations?.trim() || null,
        status: status || crop.status,
      },
      { transaction }
    );

    if (req.files && req.files.length > 0) {
      const existingPrimary = await db.CropImage.findOne({
        where: { crop_id: crop.id, is_primary: true },
        transaction,
      });

      const images = req.files.map((file, index) => ({
        crop_id: crop.id,
        image_url: `images/crops/${file.filename}`,
        original_name: file.originalname,
        is_primary: !existingPrimary && index === 0,
        display_order: index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.CropImage.bulkCreate(images, { transaction });
    }

    await transaction.commit();
    return res.redirect("/private/crops");
  } catch (error) {
    await transaction.rollback();
    console.error("ERROR AL ACTUALIZAR CULTIVO:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar el cultivo",
      error: error.message,
    });
  }
};

// ============================================================
// POST /private/crops/delete/:id — Eliminar cultivo
// ============================================================
export const deleteCrop = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const crop = await db.Crop.findByPk(id, { transaction });

    if (!crop) {
      await transaction.rollback();
      return res.redirect("/private/crops");
    }

    await db.CropImage.destroy({
      where: { crop_id: id },
      transaction,
    });

    await crop.destroy({ transaction });
    await transaction.commit();

    return res.redirect("/private/crops");
  } catch (error) {
    await transaction.rollback();
    console.error("ERROR AL ELIMINAR CULTIVO:", error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar el cultivo",
      error: error.message,
    });
  }
};
