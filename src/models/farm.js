import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Farm extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Farm.init({
    name: DataTypes.STRING,
    location_lat: DataTypes.DECIMAL,
    location_lng: DataTypes.DECIMAL,
    size_hectares: DataTypes.DECIMAL,
    user_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Farm',
  });
  return Farm;
};