import { Model } from "sequelize";

export default (sequelize, DataTypes) => {

  class Crop extends Model {

    static associate(models) {

      Crop.hasMany(models.CropImage, {

        foreignKey: "crop_id",

        as: "images",

        onDelete: "CASCADE",

        onUpdate: "CASCADE",

      });

    }

  }

  Crop.init({
    // 1. IDENTIFICACIÓN Y CLASIFICACIÓN
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },

    scientific_name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    family: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    genus: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    variety: {
      type: DataTypes.STRING(150),
      allowNull: true
    },

    // 2. REGIÓN Y DISTRIBUCIÓN
    region: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    state: {
      type: DataTypes.STRING(150),
      allowNull: true
    },

    min_altitude: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    max_altitude: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    // 3. CONDICIONES CLIMÁTICAS
    climate: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    min_temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },

    max_temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },

    min_rainfall: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    max_rainfall: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    humidity: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    // 4. CARACTERÍSTICAS DEL SUELO
    soil_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    ph_range: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    drainage: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    organic_matter: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    // 5. CICLO Y PRODUCCIÓN
    season: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    cycle: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    harvest_days: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    average_yield: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    planting_density: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    planting_depth: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    // 6. REQUERIMIENTOS HÍDRICOS Y LUMINOSOS
    water_requirement: {
      type: DataTypes.STRING(50),
      allowNull: true
    },

    irrigation_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    sunlight_requirement: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    // 7. FERTILIZACIÓN Y MANEJO
    nutrients: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    fertilization: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    requires_pruning: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },

    pollination_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    // 8. INFORMACIÓN ADICIONAL
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    observations: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // 10. ESTADO DEL CULTIVO
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "pendiente"
    }

  }, {

    sequelize,

    modelName: "Crop",

    tableName: "Crops",

    timestamps: true

  });


  return Crop;

};