export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('FarmCrops', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      farm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Farms',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      crop_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Crops', 
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      planting_date: {
        type: Sequelize.DATE
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'En Crecimiento'
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
    await queryInterface.dropTable('FarmCrops');
  }
};