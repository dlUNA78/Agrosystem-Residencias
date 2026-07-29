'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // Agregar scientific_name a Plagues (no existe en la migración base)
    const plaguesCols = await queryInterface.describeTable('Plagues');
    if (!plaguesCols.scientific_name) {
      await queryInterface.addColumn('Plagues', 'scientific_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Crops ya tiene scientific_name desde create-ccrop — no-op condicional
    const cropsCols = await queryInterface.describeTable('Crops');
    if (!cropsCols.scientific_name) {
      await queryInterface.addColumn('Crops', 'scientific_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Plagues', 'scientific_name');
    // No eliminamos de Crops porque fue creada en create-ccrop, no aquí
  },
};