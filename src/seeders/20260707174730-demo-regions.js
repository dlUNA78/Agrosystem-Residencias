export default {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('Regions', null, {});
    await queryInterface.bulkInsert('Regions', [
      { name: 'El Bajío', lat: 20.900000, lng: -101.000000, createdAt: now, updatedAt: now },
      { name: 'Michoacán', lat: 19.500000, lng: -101.800000, createdAt: now, updatedAt: now },
      { name: 'Sinaloa', lat: 24.800000, lng: -107.400000, createdAt: now, updatedAt: now },
      { name: 'Sonora', lat: 29.000000, lng: -110.000000, createdAt: now, updatedAt: now },
      { name: 'Veracruz', lat: 19.200000, lng: -96.100000, createdAt: now, updatedAt: now },
      { name: 'Chiapas', lat: 16.000000, lng: -92.000000, createdAt: now, updatedAt: now },
      { name: 'Colima', lat: 19.240000, lng: -103.720000, createdAt: now, updatedAt: now },
      { name: 'Yucatán', lat: 20.960000, lng: -89.620000, createdAt: now, updatedAt: now },
      { name: 'Puebla', lat: 19.040000, lng: -98.200000, createdAt: now, updatedAt: now },
      { name: 'Estado de México', lat: 19.350000, lng: -99.650000, createdAt: now, updatedAt: now }
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Regions', null, {});
  }
};
