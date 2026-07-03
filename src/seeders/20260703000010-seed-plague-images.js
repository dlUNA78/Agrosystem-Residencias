/**
 * Seeder para PlagueImages — imágenes adicionales del carrusel.
 * Los plague_id deben coincidir con el orden de inserción del seeder de plagas:
 *   1 = Pulgón Verde
 *   2 = Roya Amarilla del Trigo
 *   3 = Gusano Cogollero
 *   4 = Cenicilla Polvorienta
 *
 * Se usan URLs de picsum.photos con seed fijo para imágenes consistentes.
 */
export default {
  async up(queryInterface) {
    // Obtener los IDs reales de las plagas insertadas
    const plagues = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Plagues" ORDER BY "createdAt" ASC`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!plagues.length) {
      console.warn("⚠️  No se encontraron plagas. Corre primero el seeder de Plagues.");
      return;
    }

    const images = [];

    plagues.forEach((plague, index) => {
      const seed = plague.name.toLowerCase().replace(/\s+/g, "-");
      images.push(
        {
          plague_id: plague.id,
          url: `https://picsum.photos/seed/${seed}-sintomas/1200/900`,
          caption: `${plague.name} — Síntomas en campo`,
          source: "Ref: Centro de Investigación INIFAP",
          sort_order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          plague_id: plague.id,
          url: `https://picsum.photos/seed/${seed}-dano/1200/900`,
          caption: `${plague.name} — Daño foliar avanzado`,
          source: "Ref: Estación Experimental INIFAP",
          sort_order: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );
    });

    await queryInterface.bulkInsert("PlagueImages", images);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("PlagueImages", null, {});
  },
};
