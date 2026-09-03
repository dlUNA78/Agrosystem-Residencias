export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ActiveIngredients', {
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
      chemical_group: {
        type: Sequelize.STRING,
      },
      action_type: {
        type: Sequelize.STRING,
      },
      toxicological_category: {
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
  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('ActiveIngredients');
  },
};
