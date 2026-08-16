export default {
  async up(queryInterface) {
    // Limpiar imágenes de cultivos existentes
    await queryInterface.bulkDelete("CropImages", null, {});

    // Obtener los cultivos de la BD
    const crops = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Crops" ORDER BY id ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!crops.length) {
      console.warn("⚠️ No se encontraron cultivos. Ejecuta primero 20260619152645-03-seed-crops.js");
      return;
    }

    const imageMap = {
      "Maíz Blanco": "images/test/maiz_blanco.png",
      "Aguacate Hass": "images/test/aguacate_hass.png",
      "Limón Pérsico": "images/test/limon_persico.png",
      "Sorgo Forrajero": "images/test/sorgo_forrajero.png",
    };

    const images = [];

    crops.forEach((crop) => {
      const primaryUrl = imageMap[crop.name] || "images/test/default.png";

      images.push({
        crop_id: crop.id,
        image_url: primaryUrl,
        original_name: `${crop.name.toLowerCase().replace(/\s+/g, "_")}_principal.png`,
        is_primary: true,
        display_order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Imagen secundaria para galería/carrusel
      images.push({
        crop_id: crop.id,
        image_url: primaryUrl,
        original_name: `${crop.name.toLowerCase().replace(/\s+/g, "_")}_campo.png`,
        is_primary: false,
        display_order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await queryInterface.bulkInsert("CropImages", images);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("CropImages", null, {});
  },
};
