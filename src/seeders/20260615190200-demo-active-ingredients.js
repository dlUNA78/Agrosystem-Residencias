export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('ActiveIngredients', [
      {
        name: 'Glifosato',
        chemical_group: 'Glicinas',
        action_type: 'Herbicida',
        toxicological_category: 'Precaución',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Cipermetrina',
        chemical_group: 'Piretroides',
        action_type: 'Insecticida',
        toxicological_category: 'Peligro',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ActiveIngredients', null, {});
  }
};