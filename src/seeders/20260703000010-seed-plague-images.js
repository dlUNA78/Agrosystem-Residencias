/**
 * Seeder para PlagueImages — imágenes locales del carrusel y galería.
 * Utiliza las rutas de la carpeta local /images/plagas/ definidas en la tabla Plagues.
 */
export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete('PlagueImages', null, {});

    // Obtener los IDs y la imagen principal de las plagas insertadas
    const plagues = await queryInterface.sequelize.query(
      `SELECT id, name, image_url FROM "Plagues" ORDER BY "createdAt" ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    if (!plagues.length) {
      console.warn(
        '⚠️  No se encontraron plagas. Corre primero el seeder de Plagues.',
      );
      return;
    }

    const images = [];

    plagues.forEach((plague) => {
      // 1. Imagen principal desde la carpeta local /images/plagas/
      if (plague.image_url) {
        images.push({
          plague_id: plague.id,
          url: plague.image_url,
          caption: `${plague.name} — Vista principal de muestra en campo`,
          source: 'Banco de Germoplasma INIFAP',
          sort_order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });

    if (images.length) {
      await queryInterface.bulkInsert('PlagueImages', images);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('PlagueImages', null, {});
  },
};
