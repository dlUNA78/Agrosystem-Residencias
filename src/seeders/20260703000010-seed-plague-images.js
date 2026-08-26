/**
 * Seeder para PlagueImages — imágenes locales del carrusel y galería.
 * Utiliza las rutas de la carpeta local /images/plagas/ definidas en la tabla Plagues.
 */
export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete('PlagueImages', null, {});

    // Obtener los IDs y nombres de las plagas insertadas
    const plagues = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Plagues" ORDER BY "createdAt" ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT },
    );

    if (!plagues.length) {
      console.warn(
        '⚠️  No se encontraron plagas. Corre primero el seeder de Plagues.',
      );
      return;
    }

    const imageMap = {
      'Cenicilla Polvorienta': '/images/plagas/cenicilla.webp',
      'Gusano Cogollero': '/images/plagas/gusano-cogollero.webp',
      'Mosca del Mediterráneo': '/images/plagas/mosca-mediterraneo.webp',
      'Psílido Asiático de los Cítricos': '/images/plagas/psilido-asiatico.webp',
      'Pulgón Verde': '/images/plagas/pulgon-verde.webp',
      'Roya Amarilla del Trigo': '/images/plagas/roya-amarilla.webp',
      'Tizón Tardío': '/images/plagas/tizon-tardio.webp',
      'Trips Oriental': '/images/plagas/trips-oriental.webp',
    };

    const images = [];

    plagues.forEach((plague) => {
      const imageUrl = imageMap[plague.name] || '/images/test/default.png';

      images.push({
        plague_id: plague.id,
        url: imageUrl,
        caption: `${plague.name} — Vista principal de muestra en campo`,
        source: 'Banco de Germoplasma INIFAP',
        sort_order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    if (images.length) {
      await queryInterface.bulkInsert('PlagueImages', images);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('PlagueImages', null, {});
  },
};
