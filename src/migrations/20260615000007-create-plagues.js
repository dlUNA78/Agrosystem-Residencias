export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Plagues', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scientific_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING,
      },
      description: {
        type: Sequelize.TEXT,
      },
      risk_level: {
        type: Sequelize.STRING,
      },
      region: {
        type: Sequelize.STRING,
      },
      symptoms: {
        type: Sequelize.TEXT,
      },
      control_methods: {
        type: Sequelize.TEXT,
      },
      biological_control: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      biological_cycle: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      verified_by: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Plagues');
  },
};
