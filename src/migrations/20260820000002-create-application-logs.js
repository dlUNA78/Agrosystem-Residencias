export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ApplicationLogs', {
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
      producto_nombre: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ingrediente_activo: {
        type: Sequelize.STRING,
      },
      dosis: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fecha_aplicacion: {
        type: Sequelize.DATE,
      },
      notas: {
        type: Sequelize.TEXT,
      },
      applicator_name: {
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
    await queryInterface.dropTable('ApplicationLogs');
  },
};
