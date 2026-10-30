export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete('CropImages', null, {});

    const crops = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Crops" ORDER BY id ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    if (!crops.length) return;

    const imageMap = {
      Maíz: '/images/cultivos/maiz.webp',
      Trigo: '/images/cultivos/trigo.webp',
      'Limón Mexicano': '/images/cultivos/limon-mexicano.webp',
      'Naranja Dulce': '/images/cultivos/naranja-dulce.webp',
      Jitomate: '/images/cultivos/jitomate.webp',
      Papa: '/images/cultivos/papa.webp',
      Calabacita: '/images/cultivos/calabacita.webp',
    };

    const images = [];

    crops.forEach((crop) => {
      const primaryUrl = imageMap[crop.name] || '/images/cultivos/default.webp';

      images.push({
        crop_id: crop.id,
        image_url: primaryUrl,
        original_name: `${crop.name.toLowerCase().replace(/\s+/g, '_')}_principal.webp`,
        is_primary: true,
        display_order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      images.push({
        crop_id: crop.id,
        image_url: primaryUrl,
        original_name: `${crop.name.toLowerCase().replace(/\s+/g, '_')}_campo.webp`,
        is_primary: false,
        display_order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await queryInterface.bulkInsert('CropImages', images);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('CropImages', null, {});
  },
};
