import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      // Relaciones aquí
    }
  }

  Product.init(
    {
      name: DataTypes.STRING,
      category: DataTypes.STRING,
      active_ingredient: DataTypes.STRING,
      manufacturer: DataTypes.STRING,
      description: DataTypes.TEXT,
      image_url: DataTypes.STRING,
      status: DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: 'Product',
    }
  );

  return Product;
};