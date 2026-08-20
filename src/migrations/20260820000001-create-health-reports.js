export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('HealthReports', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      farm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Farms',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plaga_nombre: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      severidad: {
        type: Sequelize.STRING,
        defaultValue: 'baja',
      },
      descripcion: {
        type: Sequelize.TEXT,
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'Activa',
      },
      reporter_name: {
        type: Sequelize.STRING,
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

  async down(queryInterface) {
    await queryInterface.dropTable('HealthReports');
  },
};
