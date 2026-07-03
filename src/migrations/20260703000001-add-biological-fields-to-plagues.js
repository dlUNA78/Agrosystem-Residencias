export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Plagues', 'biological_control', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Plagues', 'biological_cycle', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Plagues', 'biological_control');
    await queryInterface.removeColumn('Plagues', 'biological_cycle');
  },
};
