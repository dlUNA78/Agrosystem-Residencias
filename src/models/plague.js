import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Plague extends Model {
    static associate(models) {
      // Relaciones aquí
    }
  }

  Plague.init(
    {
      name: DataTypes.STRING,
      category: DataTypes.STRING,
      description: DataTypes.TEXT,
      risk_level: DataTypes.STRING,
      region: DataTypes.STRING,
      image_url: DataTypes.STRING,
      symptoms: DataTypes.TEXT,
      control_methods: DataTypes.TEXT,
      status: DataTypes.BOOLEAN
    },
    {
      sequelize,
      modelName: 'Plague',
    }
  );

  return Plague;
};