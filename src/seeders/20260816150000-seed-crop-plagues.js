export default {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('CropPlagues', null, {});

    const [crops] = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Crops";`,
    );
    const [plagues] = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Plagues";`,
    );

    const getCropId = (name) => crops.find((c) => c.name === name)?.id;
    const getPlagueId = (name) => plagues.find((p) => p.name === name)?.id;

    const associations = [
      {
        crop_id: getCropId('Maíz'),
        plague_id: getPlagueId('Gusano Cogollero'),
      },
      { crop_id: getCropId('Maíz'), plague_id: getPlagueId('Pulgón Verde') },
      {
        crop_id: getCropId('Trigo'),
        plague_id: getPlagueId('Roya Amarilla del Trigo'),
      },
      { crop_id: getCropId('Trigo'), plague_id: getPlagueId('Pulgón Verde') },
      {
        crop_id: getCropId('Limón Mexicano'),
        plague_id: getPlagueId('Psílido Asiático de los Cítricos'),
      },
      {
        crop_id: getCropId('Naranja Dulce'),
        plague_id: getPlagueId('Psílido Asiático de los Cítricos'),
      },
      {
        crop_id: getCropId('Limón Mexicano'),
        plague_id: getPlagueId('Mosca del Mediterráneo'),
      },
      {
        crop_id: getCropId('Jitomate'),
        plague_id: getPlagueId('Tizón Tardío'),
      },
      {
        crop_id: getCropId('Jitomate'),
        plague_id: getPlagueId('Trips Oriental'),
      },
      { crop_id: getCropId('Papa'), plague_id: getPlagueId('Tizón Tardío') },
      { crop_id: getCropId('Papa'), plague_id: getPlagueId('Pulgón Verde') },
      {
        crop_id: getCropId('Calabacita'),
        plague_id: getPlagueId('Cenicilla Polvorienta'),
      },
      {
        crop_id: getCropId('Calabacita'),
        plague_id: getPlagueId('Trips Oriental'),
      },
    ].filter((item) => item.crop_id && item.plague_id);

    if (associations.length > 0) {
      await queryInterface.bulkInsert(
        'CropPlagues',
        associations.map((a) => ({ ...a, createdAt: now, updatedAt: now })),
        {},
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('CropPlagues', null, {});
  },
};
