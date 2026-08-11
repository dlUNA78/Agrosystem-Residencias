import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Farm extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Relación con el dueño del terreno
      Farm.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });

      // Relación con la región agrícola
      Farm.belongsTo(models.Region, {
        foreignKey: "region_id",
        as: "region",
      });
    }
  }

  Farm.init(
    {
      // ── Identificación ──
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // ── Geolocalización ──
      location_lat: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },
      location_lng: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
      },

      // ── Tamaño ──
      size_hectares: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },

      // ── Clasificación agrícola ──
      farming_type: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Ej: Temporal, Riego, Mixto",
      },

      municipality: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Ej: Uruapan, Peribán",
      },

      // ── Control ──
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: "true = activo | false = borrado lógico",
      },

      // ── Llaves foráneas ──
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      region_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Farm",
    }
  );

  return Farm;
};