import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Plague extends Model {
    static associate(models) {
      // Una plaga tiene muchas imágenes de referencia (carrusel)
      Plague.hasMany(models.PlagueImage, {
        foreignKey: "plague_id",
        as: "images",
      });

      // Una plaga se relaciona con muchos productos (tabla pivote)
      Plague.belongsToMany(models.Product, {
        through: "PlagueProducts",
        foreignKey: "plague_id",
        otherKey: "product_id",
        as: "products",
      });
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
      biological_control: DataTypes.TEXT,
      biological_cycle: DataTypes.JSONB,
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Plague",
    }
  );

  return Plague;
};