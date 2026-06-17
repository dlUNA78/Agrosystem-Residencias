export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Suppliers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },

      name: {
        type: Sequelize.STRING
      },

      rfc: {
        type: Sequelize.STRING
      },

      contact_name: {
        type: Sequelize.STRING
      },

      email: {
        type: Sequelize.STRING
      },

      phone: {
        type: Sequelize.STRING
      },

      supply_type: {
        type: Sequelize.STRING
      },

      address: {
        type: Sequelize.STRING
      },

      status: {
        type: Sequelize.STRING,
        defaultValue: 'active'
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

  async down(queryInterface) {
    await queryInterface.dropTable('Suppliers');
  }
};