export default {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Crops');

    if (!tableInfo.common_name) {
      await queryInterface.addColumn('Crops', 'common_name', {
        type: Sequelize.STRING(150),
        allowNull: true,
      });
    }

    if (!tableInfo.botanical_family) {
      await queryInterface.addColumn('Crops', 'botanical_family', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    if (!tableInfo.growth_cycle) {
      await queryInterface.addColumn('Crops', 'growth_cycle', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    if (!tableInfo.planting_season) {
      await queryInterface.addColumn('Crops', 'planting_season', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }

    if (!tableInfo.soil_requirements) {
      await queryInterface.addColumn('Crops', 'soil_requirements', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableInfo.water_requirements) {
      await queryInterface.addColumn('Crops', 'water_requirements', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableInfo.optimal_climate) {
      await queryInterface.addColumn('Crops', 'optimal_climate', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!tableInfo.image_url) {
      await queryInterface.addColumn('Crops', 'image_url', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Crops', 'common_name');
    await queryInterface.removeColumn('Crops', 'botanical_family');
    await queryInterface.removeColumn('Crops', 'growth_cycle');
    await queryInterface.removeColumn('Crops', 'planting_season');
    await queryInterface.removeColumn('Crops', 'soil_requirements');
    await queryInterface.removeColumn('Crops', 'water_requirements');
    await queryInterface.removeColumn('Crops', 'optimal_climate');
    await queryInterface.removeColumn('Crops', 'image_url');
  },
};
