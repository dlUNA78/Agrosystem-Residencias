export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('Plagues', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },

    name: {
      type: Sequelize.STRING,
      allowNull: false,
    },

    category: {
      type: Sequelize.STRING,
      allowNull: false,
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

    image_url: {
      type: Sequelize.STRING,
    },

    symptoms: {
      type: Sequelize.TEXT,
    },

    control_methods: {
      type: Sequelize.TEXT,
    },

    status: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },

    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },

    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('Plagues');
}
