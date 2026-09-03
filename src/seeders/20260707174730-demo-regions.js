export default {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('Regions', null, {});
    await queryInterface.bulkInsert(
      'Regions',
      [
        {
          name: 'El Bajío',
          lat: 20.9,
          lng: -101.0,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Michoacán',
          lat: 19.5,
          lng: -101.8,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Sinaloa',
          lat: 24.8,
          lng: -107.4,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Sonora',
          lat: 29.0,
          lng: -110.0,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Veracruz',
          lat: 19.2,
          lng: -96.1,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Chiapas',
          lat: 16.0,
          lng: -92.0,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Colima',
          lat: 19.24,
          lng: -103.72,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Yucatán',
          lat: 20.96,
          lng: -89.62,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Puebla',
          lat: 19.04,
          lng: -98.2,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: 'Estado de México',
          lat: 19.35,
          lng: -99.65,
          createdAt: now,
          updatedAt: now,
        },
      ],
      {},
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Regions', null, {});
  },
};
