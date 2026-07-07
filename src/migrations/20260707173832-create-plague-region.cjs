'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PlagueRegions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      plague_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Plagues',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      region_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Regions',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      risk_level: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PlagueRegions');
  }
};
