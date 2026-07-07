'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert('Regions', [
      { name: "El Bajío", lat: 20.9, lng: -101.0, createdAt: now, updatedAt: now },
      { name: "Norte de Tamaulipas", lat: 26.2, lng: -98.5, createdAt: now, updatedAt: now },
      { name: "Sur de Tamaulipas", lat: 23.0, lng: -99.0, createdAt: now, updatedAt: now },
      { name: "Tamaulipas", lat: 24.5, lng: -99.0, createdAt: now, updatedAt: now },
      { name: "Sonora", lat: 29.0, lng: -110.0, createdAt: now, updatedAt: now },
      { name: "Sinaloa", lat: 24.8, lng: -107.4, createdAt: now, updatedAt: now },
      { name: "Veracruz", lat: 19.2, lng: -96.1, createdAt: now, updatedAt: now },
      { name: "Jalisco", lat: 20.7, lng: -103.4, createdAt: now, updatedAt: now },
      { name: "Chiapas", lat: 16.0, lng: -92.0, createdAt: now, updatedAt: now },
      { name: "Oaxaca", lat: 17.0, lng: -96.7, createdAt: now, updatedAt: now },
      { name: "Tabasco", lat: 18.0, lng: -92.9, createdAt: now, updatedAt: now },
      { name: "Guanajuato", lat: 21.0, lng: -101.3, createdAt: now, updatedAt: now },
      { name: "Michoacán", lat: 19.5, lng: -101.8, createdAt: now, updatedAt: now }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Regions', null, {});
  }
};
