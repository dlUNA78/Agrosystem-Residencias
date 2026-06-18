import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class FarmCrop extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  FarmCrop.init({
    farm_id: DataTypes.INTEGER,
    crop_id: DataTypes.INTEGER,
    planting_date: DataTypes.DATE,
    is_active: DataTypes.BOOLEAN,
    status: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'FarmCrop',
  });
  return FarmCrop;
};