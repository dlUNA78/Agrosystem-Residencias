export default {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('HealthReports', 'farm_crop_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'FarmCrops',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    } catch (e) {
      // Ignorar si ya existe
    }

    try {
      await queryInterface.addColumn('HealthReports', 'etapa_nombre', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      // Ignorar si ya existe
    }

    try {
      await queryInterface.addColumn('ApplicationLogs', 'farm_crop_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'FarmCrops',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    } catch (e) {
      // Ignorar si ya existe
    }

    try {
      await queryInterface.addColumn('ApplicationLogs', 'etapa_nombre', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      // Ignorar si ya existe
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('HealthReports', 'farm_crop_id');
    await queryInterface.removeColumn('HealthReports', 'etapa_nombre');
    await queryInterface.removeColumn('ApplicationLogs', 'farm_crop_id');
    await queryInterface.removeColumn('ApplicationLogs', 'etapa_nombre');
  },
};
