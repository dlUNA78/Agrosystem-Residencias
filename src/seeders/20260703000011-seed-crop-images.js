export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete('CropImages', null, {});

    const crops = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Crops" ORDER BY id ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!crops.length) return;

    const imageMap = {
      'Maíz': '/images/cultivos/maiz.jpg',
      'Trigo': '/images/cultivos/trigo.jpg',
      'Limón Mexicano': '/images/cultivos/limon-mexicano.jpg',
      'Naranja Dulce': '/images/cultivos/naranja-dulce.jpg',
      'Jitomate': '/images/cultivos/jitomate.jpg',
      'Papa': '/images/cultivos/papa.jpg',
      'Calabacita': '/images/cultivos/calabacita.jpg'
    };

    const images = [];

    crops.forEach((crop) => {
      const primaryUrl = imageMap[crop.name] || '/images/cultivos/default.jpg';

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
