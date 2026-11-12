// src/migrations/20261108200001-add-source-to-crop-and-product-images.js
export default {
  async up(queryInterface, Sequelize) {
    const cropImagesTable = await queryInterface.describeTable('CropImages');
    if (!cropImagesTable.source) {
      await queryInterface.addColumn('CropImages', 'source', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    const productImagesTable =
      await queryInterface.describeTable('ProductImages');
    if (!productImagesTable.source) {
      await queryInterface.addColumn('ProductImages', 'source', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const cropImagesTable = await queryInterface.describeTable('CropImages');
    if (cropImagesTable.source) {
      await queryInterface.removeColumn('CropImages', 'source');
    }

    const productImagesTable =
      await queryInterface.describeTable('ProductImages');
    if (productImagesTable.source) {
      await queryInterface.removeColumn('ProductImages', 'source');
    }
  },
};
