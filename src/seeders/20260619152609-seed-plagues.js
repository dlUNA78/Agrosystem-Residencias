export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "Plagues",
      [
        {
          name: "Pulgón Verde",
          scientific_name: "Myzus persicae",
          category: "Insecto",
          description: "Plaga que se alimenta de la savia de las plantas.",
          risk_level: "Alto",
          region: "Centro de México",
          image_url: "https://example.com/pulgon.jpg",
          symptoms: "Hojas enrolladas y amarillentas.",
          control_methods: "Control biológico y aplicación de insecticidas.",
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Roya",
          scientific_name: "Puccinia graminis",
          category: "Hongo",
          description: "Enfermedad causada por hongos que afecta las hojas.",
          risk_level: "Medio",
          region: "Norte de México",
          image_url: "https://example.com/roya.jpg",
          symptoms: "Manchas anaranjadas en las hojas.",
          control_methods: "Aplicación de fungicidas y eliminación de hojas enfermas.",
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Plagues", null, {});
  },
};