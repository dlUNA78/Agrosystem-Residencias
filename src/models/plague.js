import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Plague extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  Plague.init(
    {
      name: DataTypes.STRING,
      scientific_name: DataTypes.STRING,
      category: DataTypes.STRING,
      description: DataTypes.TEXT,
      risk_level: DataTypes.STRING,
      region: DataTypes.STRING,
      image_url: DataTypes.STRING,
      symptoms: DataTypes.TEXT,
      control_methods: DataTypes.TEXT,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Plague",
    }
  );

  return Plague;
};