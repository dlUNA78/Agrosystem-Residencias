export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('Crops', {
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

    scientific_name: {
      type: Sequelize.STRING,
    },

    category: {
      type: Sequelize.STRING,
    },

    description: {
      type: Sequelize.TEXT,
    },

    season: {
      type: Sequelize.STRING,
    },

    image_url: {
      type: Sequelize.STRING,
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
  await queryInterface.dropTable('Crops');
}