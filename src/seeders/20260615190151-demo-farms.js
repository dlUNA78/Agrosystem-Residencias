export default {
  async up(queryInterface, Sequelize) {
    // Buscamos los usuarios creados para no adivinar sus IDs
    const users = await queryInterface.sequelize.query(`SELECT id FROM "Users";`);
    const userRows = users[0];

    if (userRows.length === 0) return;

    await queryInterface.bulkInsert('Farms', [
      {
        name: 'Huerta El Milagro',
        location_lat: 19.432608,  // Coordenadas dummy para el mapa Leaflet
        location_lng: -99.133209,
        size_hectares: 5.5,
        user_id: userRows[0].id, // Se le asigna al Admin
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Parcela La Esperanza',
        location_lat: 19.435000,
        location_lng: -99.140000,
        size_hectares: 2.0,
        user_id: userRows[1] ? userRows[1].id : userRows[0].id, // Se le asigna a Juan
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Farms', null, {});
  }
};