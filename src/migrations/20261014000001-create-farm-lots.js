export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FarmLots', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      farm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Farms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      size_hectares: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint('FarmLots', {
      fields: ['farm_id', 'name'],
      type: 'unique',
      name: 'farm_lots_farm_id_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FarmLots');
  },
};
