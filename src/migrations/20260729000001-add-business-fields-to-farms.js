export default {
  async up(queryInterface, Sequelize) {
    // Agregamos los 4 campos de negocio a la tabla Farms existente
    await queryInterface.addColumn("Farms", "farming_type", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Ej: Temporal, Riego, Mixto",
    });

    await queryInterface.addColumn("Farms", "municipality", {
      type: Sequelize.STRING,
      allowNull: true,
      comment: "Ej: Uruapan, Peribán",
    });

    await queryInterface.addColumn("Farms", "status", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "true = activo | false = borrado lógico",
    });

    await queryInterface.addColumn("Farms", "region_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Regions",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Farms", "farming_type");
    await queryInterface.removeColumn("Farms", "municipality");
    await queryInterface.removeColumn("Farms", "status");
    await queryInterface.removeColumn("Farms", "region_id");
  },
};
