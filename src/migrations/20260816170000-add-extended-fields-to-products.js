export default {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Products');

    if (!tableInfo.mode_of_action) {
      await queryInterface.addColumn('Products', 'mode_of_action', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableInfo.hazard_category) {
      await queryInterface.addColumn('Products', 'hazard_category', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableInfo.suggested_dosage) {
      await queryInterface.addColumn('Products', 'suggested_dosage', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableInfo.safety_interval_days) {
      await queryInterface.addColumn('Products', 'safety_interval_days', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!tableInfo.formulation_type) {
      await queryInterface.addColumn('Products', 'formulation_type', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!tableInfo.safety_sheet_url) {
      await queryInterface.addColumn('Products', 'safety_sheet_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Products', 'mode_of_action');
    await queryInterface.removeColumn('Products', 'hazard_category');
    await queryInterface.removeColumn('Products', 'suggested_dosage');
    await queryInterface.removeColumn('Products', 'safety_interval_days');
    await queryInterface.removeColumn('Products', 'formulation_type');
    await queryInterface.removeColumn('Products', 'safety_sheet_url');
  },
};
