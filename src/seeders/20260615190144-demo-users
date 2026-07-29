export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Users', [
      {
        full_name: 'Administrador Principal',
        email: 'admin@agrosystem.com',
        password_hash: 'hash_falso_123', // En el futuro lo encriptarán
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        full_name: 'Juan El Agricultor',
        email: 'juan@agricultor.com',
        password_hash: 'hash_falso_123',
        role: 'agricultor',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', null, {});
  }
};