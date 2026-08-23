export default {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.addColumn('HealthReports', 'etapa_nombre', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {}

    try {
      await queryInterface.addColumn('ApplicationLogs', 'etapa_nombre', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {}
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('HealthReports', 'etapa_nombre');
    await queryInterface.removeColumn('ApplicationLogs', 'etapa_nombre');
  },
};
