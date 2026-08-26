import { Sequelize } from 'sequelize';

export async function up(queryInterface) {
  await queryInterface.removeColumn('Products', 'image_url');
}

export async function down(queryInterface) {
  await queryInterface.addColumn('Products', 'image_url', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
}
