export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      code: {
        type: Sequelize.STRING,
        unique: true
      },
      full_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: true // Se permite nulo para quienes inicien sesión con Google
      },
      role: {
        type: Sequelize.STRING,
        defaultValue: 'agricultor',
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING
      },
      address: {
        type: Sequelize.TEXT
      },
      job_title: {
        type: Sequelize.STRING
      },
      shift: {
        type: Sequelize.STRING
      },
      photo_url: {
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }
};