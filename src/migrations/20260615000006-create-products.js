export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      active_ingredient: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      registration_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      manufacturer: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      validation_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'En revisión',
      },
      expiration_date: {
        type: Sequelize.DATE,
      },
      target_crops: {
        type: Sequelize.TEXT,
      },
      description: {
        type: Sequelize.TEXT,
      },
      image_url: {
        type: Sequelize.STRING,
      },
      mode_of_action: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      hazard_category: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      suggested_dosage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      safety_interval_days: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      formulation_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      safety_sheet_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.BOOLEAN,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Products');
  },
};
