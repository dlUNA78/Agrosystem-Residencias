export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "Products",
      [
        {
          name: "Herbicida Total",
          category: "Herbicida",
          active_ingredient: "Glifosato",
          registration_code: "REG-001",
          manufacturer: "AgroTech",
          validation_status: "Aprobado",
          expiration_date: new Date("2028-12-31"),
          target_crops: "Maíz, Trigo, Sorgo",
          description: "Herbicida de amplio espectro para el control de malezas.",
          image_url: "https://example.com/herbicida.jpg",
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Insecticida Plus",
          category: "Insecticida",
          active_ingredient: "Imidacloprid",
          registration_code: "REG-002",
          manufacturer: "Campo Verde",
          validation_status: "Aprobado",
          expiration_date: new Date("2027-08-15"),
          target_crops: "Tomate, Chile, Papa",
          description: "Control efectivo contra insectos de hoja y tallo.",
          image_url: "https://example.com/insecticida.jpg",
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Fungicida Max",
          category: "Fungicida",
          active_ingredient: "Azoxistrobin",
          registration_code: "REG-003",
          manufacturer: "BioAgro",
          validation_status: "Pendiente",
          expiration_date: new Date("2029-05-20"),
          target_crops: "Fresa, Uva, Pepino",
          description: "Prevención y control de enfermedades causadas por hongos.",
          image_url: "https://example.com/fungicida.jpg",
          status: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Products", null, {});
  },
};