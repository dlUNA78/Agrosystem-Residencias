export default {
  async up(queryInterface, Sequelize) {
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
          image_url: "https://example.com/maiz.jpg",
          status: true,
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
          image_url: "https://example.com/frijol.jpg",
          status: true,
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
          image_url: "https://example.com/trigo.jpg",
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Crops", null, {});
  },
};