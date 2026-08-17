import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Un producto puede recomendarse para muchas plagas (tabla pivote PlagueProducts)
      Product.belongsToMany(models.Plague, {
        through: "PlagueProducts",
        foreignKey: "product_id",
        otherKey: "plague_id",
        as: "plagues",
      });

      // Un producto está autorizado para muchos cultivos (tabla pivote CropProducts)
      Product.belongsToMany(models.Crop, {
        through: "CropProducts",
        foreignKey: "product_id",
        otherKey: "crop_id",
        as: "crops",
      });
    }
  }

  Product.init({
    name: DataTypes.STRING,
    category: DataTypes.STRING,
    active_ingredient: DataTypes.STRING,
    registration_code: DataTypes.STRING,
    manufacturer: DataTypes.STRING,
    validation_status: DataTypes.STRING,
    expiration_date: DataTypes.DATE,
    target_crops: DataTypes.TEXT,
    description: DataTypes.TEXT,
    image_url: DataTypes.STRING,
    mode_of_action: DataTypes.STRING,
    hazard_category: DataTypes.STRING,
    suggested_dosage: DataTypes.STRING,
    safety_interval_days: DataTypes.INTEGER,
    formulation_type: DataTypes.STRING,
    safety_sheet_url: DataTypes.STRING,
    status: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Product',
  });

  return Product;
};