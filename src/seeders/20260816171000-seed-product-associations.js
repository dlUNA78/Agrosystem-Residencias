export default {
  async up(queryInterface) {
    await queryInterface.bulkDelete("PlagueProducts", null, {});
    await queryInterface.bulkDelete("CropProducts", null, {});

    const [products] = await queryInterface.sequelize.query('SELECT id, name FROM "Products";');
    const [plagues] = await queryInterface.sequelize.query('SELECT id, name FROM "Plagues";');
    const [crops] = await queryInterface.sequelize.query('SELECT id, name FROM "Crops";');

    if (!products.length) return;

    const findProd = (name) => products.find((p) => p.name.toLowerCase().includes(name.toLowerCase()))?.id;
    const findPlague = (name) => plagues.find((p) => p.name.toLowerCase().includes(name.toLowerCase()))?.id;
    const findCrop = (name) => crops.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))?.id;

    // Relaciones Producto <-> Plaga
    const productPlagues = [
      { prod: "Confidor", plague: "Pulgón Verde" },
      { prod: "Actara", plague: "Pulgón Verde" },
      { prod: "Engeo", plague: "Gusano Cogollero" },
      { prod: "Engeo", plague: "Pulgón Verde" },
      { prod: "Amistar Xtra", plague: "Roya Amarilla" },
      { prod: "Tilt 250 EC", plague: "Roya Amarilla" },
      { prod: "Tilt 250 EC", plague: "Cenicilla Polvorienta" },
      { prod: "Dipel DF", plague: "Gusano Cogollero" },
    ];

    const ppRecords = [];
    for (const item of productPlagues) {
      const pId = findProd(item.prod);
      const plId = findPlague(item.plague);
      if (pId && plId) {
        ppRecords.push({
          product_id: pId,
          plague_id: plId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (ppRecords.length > 0) {
      await queryInterface.bulkInsert("PlagueProducts", ppRecords, {});
    }

    // Relaciones Producto <-> Cultivo
    const productCrops = [
      { prod: "Confidor", crop: "Trigo Harinero" },
      { prod: "Confidor", crop: "Maíz Blanco" },
      { prod: "Confidor", crop: "Chile Serrano" },
      { prod: "Actara", crop: "Trigo Harinero" },
      { prod: "Actara", crop: "Jitomate Saladette" },
      { prod: "Engeo", crop: "Maíz Blanco" },
      { prod: "Engeo", crop: "Sorgo Forrajero" },
      { prod: "Amistar Xtra", crop: "Trigo Harinero" },
      { prod: "Amistar Xtra", crop: "Maíz Blanco" },
      { prod: "Tilt 250 EC", crop: "Trigo Harinero" },
      { prod: "Dipel DF", crop: "Maíz Blanco" },
      { prod: "Dipel DF", crop: "Jitomate Saladette" },
      { prod: "Dipel DF", crop: "Frijol Negro" },
    ];

    const pcRecords = [];
    for (const item of productCrops) {
      const pId = findProd(item.prod);
      const cId = findCrop(item.crop);
      if (pId && cId) {
        pcRecords.push({
          product_id: pId,
          crop_id: cId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (pcRecords.length > 0) {
      await queryInterface.bulkInsert("CropProducts", pcRecords, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("PlagueProducts", null, {});
    await queryInterface.bulkDelete("CropProducts", null, {});
  },
};
