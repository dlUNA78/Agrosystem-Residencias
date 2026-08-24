export default {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('PlagueRegions', null, {});

    const [plagues] = await queryInterface.sequelize.query(`SELECT id, name FROM "Plagues";`);
    const [regions] = await queryInterface.sequelize.query(`SELECT id, name FROM "Regions";`);

    const getPId = (name) => plagues.find((p) => p.name === name)?.id;
    const getRId = (name) => regions.find((r) => r.name === name)?.id;

    const relations = [
      { plague_id: getPId('Cenicilla Polvorienta'), region_id: getRId('Michoacán'), risk_level: 'Medio' },
      { plague_id: getPId('Cenicilla Polvorienta'), region_id: getRId('Sinaloa'), risk_level: 'Medio' },
      { plague_id: getPId('Gusano Cogollero'), region_id: getRId('El Bajío'), risk_level: 'Alto' },
      { plague_id: getPId('Gusano Cogollero'), region_id: getRId('Michoacán'), risk_level: 'Alto' },
      { plague_id: getPId('Mosca del Mediterráneo'), region_id: getRId('Chiapas'), risk_level: 'Alto' },
      { plague_id: getPId('Psílido Asiático de los Cítricos'), region_id: getRId('Michoacán'), risk_level: 'Alto' },
      { plague_id: getPId('Psílido Asiático de los Cítricos'), region_id: getRId('Colima'), risk_level: 'Alto' },
      { plague_id: getPId('Psílido Asiático de los Cítricos'), region_id: getRId('Veracruz'), risk_level: 'Medio' },
      { plague_id: getPId('Pulgón Verde'), region_id: getRId('El Bajío'), risk_level: 'Medio' },
      { plague_id: getPId('Pulgón Verde'), region_id: getRId('Sonora'), risk_level: 'Alto' },
      { plague_id: getPId('Roya Amarilla del Trigo'), region_id: getRId('Sonora'), risk_level: 'Alto' },
      { plague_id: getPId('Roya Amarilla del Trigo'), region_id: getRId('El Bajío'), risk_level: 'Medio' },
      { plague_id: getPId('Tizón Tardío'), region_id: getRId('Estado de México'), risk_level: 'Alto' },
      { plague_id: getPId('Tizón Tardío'), region_id: getRId('Puebla'), risk_level: 'Alto' },
      { plague_id: getPId('Trips Oriental'), region_id: getRId('Sinaloa'), risk_level: 'Alto' },
      { plague_id: getPId('Trips Oriental'), region_id: getRId('Michoacán'), risk_level: 'Medio' }
    ].filter((rel) => rel.plague_id && rel.region_id);

    if (relations.length > 0) {
      await queryInterface.bulkInsert(
        'PlagueRegions',
        relations.map((r) => ({ ...r, createdAt: now, updatedAt: now })),
        {}
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('PlagueRegions', null, {});
  }
};
