export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Plagues', 'verified_by', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Plagues', 'verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Plagues', 'verified_by');
    await queryInterface.removeColumn('Plagues', 'verified_at');
  },
};
