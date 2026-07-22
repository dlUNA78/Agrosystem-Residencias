export default {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('Crops', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      scientific_name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },

      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      family: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      genus: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      variety: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      region: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      state: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      min_altitude: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      max_altitude: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      climate: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      min_temperature: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      max_temperature: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      min_rainfall: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      max_rainfall: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      humidity: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      soil_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      ph_range: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      drainage: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      organic_matter: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      season: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      cycle: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      harvest_days: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      average_yield: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      planting_density: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },

      planting_depth: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      water_requirement: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      irrigation_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      sunlight_requirement: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      nutrients: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      fertilization: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      requires_pruning: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },

      pollination_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      observations: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'pendiente',
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

    await queryInterface.dropTable('Crops');

  },

};