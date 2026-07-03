import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Crop extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  Crop.init({
    name: DataTypes.STRING,
    scientific_name: DataTypes.STRING,
    category: DataTypes.STRING,
    description: DataTypes.TEXT,
    climate: DataTypes.STRING,
    region: DataTypes.STRING,
    image_url: DataTypes.STRING,
    status: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Crop',
  });

  return Crop;
};