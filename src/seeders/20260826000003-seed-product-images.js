export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete('ProductImages', null, {});

    const products = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Products" ORDER BY id ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    if (!products.length) return;

    const imageMap = {
      'Amistar Top': '/images/products/amistar-top.webp',
      'Ridomil Gold Bravo': '/images/products/ridomil-gold-bravo.webp',
      Coragen: '/images/products/coragen.webp',
      'Belt 480 SC': '/images/products/belt-480-sc.webp',
      'Confidor 350 SC': '/images/products/confidor-350-sc.webp',
      'Movento 150 SC': '/images/products/movento-150-sc.webp',
      'Success 120 SC': '/images/products/success-120-sc.webp',
      'Folicur 250 EW': '/images/products/folicur-250-ew.webp',
    };

    const images = [];

    products.forEach((product) => {
      const primaryUrl = imageMap[product.name] || '/images/products/default.png';

      images.push({
        product_id: product.id,
        image_url: primaryUrl,
        original_name: `${product.name.toLowerCase().replace(/\s+/g, '_')}_principal.webp`,
        is_primary: true,
        display_order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    await queryInterface.bulkInsert('ProductImages', images);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('ProductImages', null, {});
  },
};
