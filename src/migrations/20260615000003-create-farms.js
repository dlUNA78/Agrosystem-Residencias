export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Farms', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      location_lat: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      location_lng: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },
      size_hectares: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      farming_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Ej: Temporal, Riego, Mixto',
      },
      municipality: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Ej: Uruapan, Peribán',
      },
      status: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'true = activo | false = borrado lógico',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      region_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Regions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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
  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('Farms');
  },
};
