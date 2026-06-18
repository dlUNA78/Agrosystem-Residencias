import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  Product.init({
    name: DataTypes.STRING,
    category: DataTypes.STRING,
    active_ingredient: DataTypes.STRING,
    manufacturer: DataTypes.STRING,
    description: DataTypes.TEXT,
    image_url: DataTypes.STRING,
    status: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Product',
  });

  return Product;
};