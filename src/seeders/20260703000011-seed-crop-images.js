export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete('CropImages', null, {});

    const crops = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Crops" ORDER BY id ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!crops.length) return;

    const imageMap = {
      'Maíz': '/uploads/crops/maiz.jpg',
      'Trigo': '/uploads/crops/trigo.jpg',
      'Limón Mexicano': '/uploads/crops/limon.jpg',
      'Naranja Dulce': '/uploads/crops/naranja.jpg',
      'Jitomate': '/uploads/crops/jitomate.jpg',
      'Papa': '/uploads/crops/papa.jpg',
      'Calabacita': '/uploads/crops/calabacita.jpg'
    };

    const images = [];

    crops.forEach((crop) => {
      const primaryUrl = imageMap[crop.name] || '/uploads/crops/default.jpg';

      images.push({
        crop_id: crop.id,
        image_url: primaryUrl,
        original_name: `${crop.name.toLowerCase().replace(/\s+/g, '_')}_principal.jpg`,
        is_primary: true,
        display_order: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      images.push({
        crop_id: crop.id,
        image_url: primaryUrl,
        original_name: `${crop.name.toLowerCase().replace(/\s+/g, '_')}_campo.jpg`,
        is_primary: false,
        display_order: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    await queryInterface.bulkInsert('CropImages', images);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('CropImages', null, {});
  }
};
