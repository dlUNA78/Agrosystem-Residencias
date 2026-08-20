export default {
  async up(queryInterface, Sequelize) {
    // 1. Quitar la restricción NOT NULL de crop_id usando SQL nativo en PostgreSQL
    await queryInterface.sequelize.query(
      'ALTER TABLE "FarmCrops" ALTER COLUMN "crop_id" DROP NOT NULL;',
    );

    // 2. Agregar columna custom_crop_name para cultivos fuera de catálogo ("Otro")
    try {
      await queryInterface.addColumn('FarmCrops', 'custom_crop_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    } catch (e) {
      // Ignorar si ya existe
    }

    // 3. Agregar columna area_section para divisiones por lotes/áreas
    try {
      await queryInterface.addColumn('FarmCrops', 'area_section', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'General',
      });
    } catch (e) {
      // Ignorar si ya existe
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('FarmCrops', 'area_section');
    await queryInterface.removeColumn('FarmCrops', 'custom_crop_name');
  },
};
