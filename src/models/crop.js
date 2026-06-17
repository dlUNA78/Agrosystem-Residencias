import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Crop extends Model {
    static associate(models) {
      // Relaciones aquí
    }
  }

  Crop.init(
    {
      name: DataTypes.STRING,
      scientific_name: DataTypes.STRING,
      category: DataTypes.STRING,
      description: DataTypes.TEXT,
      season: DataTypes.STRING,
      image_url: DataTypes.STRING,
      status: DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: 'Crop',
    }
  );

  return Crop;
};