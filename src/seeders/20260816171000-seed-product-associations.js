export default {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('PlagueProducts', null, {});
    await queryInterface.bulkDelete('CropProducts', null, {});

    const [crops] = await queryInterface.sequelize.query(`SELECT id, name FROM "Crops";`);
    const [plagues] = await queryInterface.sequelize.query(`SELECT id, name FROM "Plagues";`);
    const [products] = await queryInterface.sequelize.query(`SELECT id, name FROM "Products";`);

    const getCId = (name) => crops.find((c) => c.name === name)?.id;
    const getPId = (name) => plagues.find((p) => p.name === name)?.id;
    const getProdId = (name) => products.find((pr) => pr.name === name)?.id;

    // 1. Relación PlagueProducts
    const plagueProd = [
      { plague_id: getPId('Cenicilla Polvorienta'), product_id: getProdId('Amistar Top') },
      { plague_id: getPId('Cenicilla Polvorienta'), product_id: getProdId('Folicur 250 EW') },
      { plague_id: getPId('Gusano Cogollero'), product_id: getProdId('Coragen') },
      { plague_id: getPId('Gusano Cogollero'), product_id: getProdId('Belt 480 SC') },
      { plague_id: getPId('Mosca del Mediterráneo'), product_id: getProdId('Success 120 SC') },
      { plague_id: getPId('Psílido Asiático de los Cítricos'), product_id: getProdId('Confidor 350 SC') },
      { plague_id: getPId('Psílido Asiático de los Cítricos'), product_id: getProdId('Movento 150 SC') },
      { plague_id: getPId('Pulgón Verde'), product_id: getProdId('Confidor 350 SC') },
      { plague_id: getPId('Pulgón Verde'), product_id: getProdId('Movento 150 SC') },
      { plague_id: getPId('Roya Amarilla del Trigo'), product_id: getProdId('Folicur 250 EW') },
      { plague_id: getPId('Roya Amarilla del Trigo'), product_id: getProdId('Amistar Top') },
      { plague_id: getPId('Tizón Tardío'), product_id: getProdId('Ridomil Gold Bravo') },
      { plague_id: getPId('Tizón Tardío'), product_id: getProdId('Amistar Top') },
      { plague_id: getPId('Trips Oriental'), product_id: getProdId('Success 120 SC') },
      { plague_id: getPId('Trips Oriental'), product_id: getProdId('Movento 150 SC') }
    ].filter((item) => item.plague_id && item.product_id);

    if (plagueProd.length > 0) {
      await queryInterface.bulkInsert(
        'PlagueProducts',
        plagueProd.map((a) => ({ ...a, createdAt: now, updatedAt: now })),
        {}
      );
    }

    // 2. Relación CropProducts
    const cropProd = [
      { crop_id: getCId('Maíz'), product_id: getProdId('Coragen') },
      { crop_id: getCId('Maíz'), product_id: getProdId('Belt 480 SC') },
      { crop_id: getCId('Maíz'), product_id: getProdId('Confidor 350 SC') },
      { crop_id: getCId('Trigo'), product_id: getProdId('Folicur 250 EW') },
      { crop_id: getCId('Trigo'), product_id: getProdId('Amistar Top') },
      { crop_id: getCId('Limón Mexicano'), product_id: getProdId('Confidor 350 SC') },
      { crop_id: getCId('Limón Mexicano'), product_id: getProdId('Movento 150 SC') },
      { crop_id: getCId('Limón Mexicano'), product_id: getProdId('Success 120 SC') },
      { crop_id: getCId('Naranja Dulce'), product_id: getProdId('Confidor 350 SC') },
      { crop_id: getCId('Naranja Dulce'), product_id: getProdId('Movento 150 SC') },
      { crop_id: getCId('Jitomate'), product_id: getProdId('Amistar Top') },
      { crop_id: getCId('Jitomate'), product_id: getProdId('Ridomil Gold Bravo') },
      { crop_id: getCId('Jitomate'), product_id: getProdId('Success 120 SC') },
      { crop_id: getCId('Papa'), product_id: getProdId('Ridomil Gold Bravo') },
      { crop_id: getCId('Papa'), product_id: getProdId('Confidor 350 SC') },
      { crop_id: getCId('Calabacita'), product_id: getProdId('Amistar Top') },
      { crop_id: getCId('Calabacita'), product_id: getProdId('Success 120 SC') }
    ].filter((item) => item.crop_id && item.product_id);

    if (cropProd.length > 0) {
      await queryInterface.bulkInsert(
        'CropProducts',
        cropProd.map((a) => ({ ...a, createdAt: now, updatedAt: now })),
        {}
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('PlagueProducts', null, {});
    await queryInterface.bulkDelete('CropProducts', null, {});
  }
};
