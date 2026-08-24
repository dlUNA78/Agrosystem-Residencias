import { Sequelize } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.removeColumn('Crops', 'image_url');
}

export async function down(queryInterface) {
  await queryInterface.addColumn('Crops', 'image_url', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
}
