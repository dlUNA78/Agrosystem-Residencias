export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete("CropPlagues", null, {});

    // Obtener los IDs de cultivos y plagas de la base de datos
    const [crops] = await queryInterface.sequelize.query('SELECT id, name FROM "Crops";');
    const [plagues] = await queryInterface.sequelize.query('SELECT id, name FROM "Plagues";');

    if (!crops.length || !plagues.length) return;

    const findCrop = (name) => crops.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))?.id;
    const findPlague = (name) => plagues.find((p) => p.name.toLowerCase().includes(name.toLowerCase()))?.id;

    const relaciones = [
      { cropName: "Maíz Blanco", plagueName: "Gusano Cogollero" },
      { cropName: "Maíz Blanco", plagueName: "Pulgón Verde" },
      { cropName: "Trigo Harinero", plagueName: "Roya Amarilla del Trigo" },
      { cropName: "Trigo Harinero", plagueName: "Pulgón Verde" },
      { cropName: "Jitomate Saladette", plagueName: "Cenicilla Polvorienta" },
      { cropName: "Frijol Negro", plagueName: "Gusano Cogollero" },
      { cropName: "Chile Serrano", plagueName: "Pulgón Verde" },
      { cropName: "Sorgo Forrajero", plagueName: "Pulgón Verde" },
    ];

    const records = [];
    for (const r of relaciones) {
      const cId = findCrop(r.cropName);
      const pId = findPlague(r.plagueName);

      if (cId && pId) {
        records.push({
          crop_id: cId,
          plague_id: pId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (records.length > 0) {
      await queryInterface.bulkInsert("CropPlagues", records, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("CropPlagues", null, {});
  },
};
