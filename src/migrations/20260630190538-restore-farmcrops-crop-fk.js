'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('FarmCrops', {
      fields: ['crop_id'],
      type: 'foreign key',
      name: 'FarmCrops_crop_id_fkey',
      references: {
        table: 'Crops',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('FarmCrops', 'FarmCrops_crop_id_fkey');
  },
};