export default {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "Crops",
      [
        {
          name: "Maíz",
          scientific_name: "Zea mays",
          category: "Cereal",
          description: "Cultivo básico utilizado para consumo humano y animal.",
          climate: "Templado",
          region: "Centro de México",
          status: "activo",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Frijol",
          scientific_name: "Phaseolus vulgaris",
          category: "Leguminosa",
          description: "Cultivo rico en proteínas y ampliamente consumido.",
          climate: "Cálido",
          region: "Sur de México",
          status: "activo",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Trigo",
          scientific_name: "Triticum aestivum",
          category: "Cereal",
          description: "Cultivo utilizado para la producción de harina.",
          climate: "Frío",
          region: "Norte de México",
          status: "activo",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Crops", null, {});
  },
};