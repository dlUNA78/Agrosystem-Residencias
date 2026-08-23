export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FarmCropProgresses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      farm_crop_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'FarmCrops',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stage_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      stage_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      estimated_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      real_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Pendiente', // 'Pendiente' | 'En Progreso' | 'Completada'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('FarmCropProgresses');
  },
};
