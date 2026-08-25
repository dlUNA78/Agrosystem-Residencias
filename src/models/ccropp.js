import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Crop extends Model {
    static associate(models) {
      // 1. Relación con imágenes de referencia (galería)
      Crop.hasMany(models.CropImage, {
        foreignKey: 'crop_id',
        as: 'images',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });

      // 2. Predios Activos (Terrenos donde se siembra el cultivo)
      Crop.belongsToMany(models.Farm, {
        through: models.FarmCrop || 'FarmCrops',
        foreignKey: 'crop_id',
        otherKey: 'farm_id',
        as: 'farms',
      });

      // 3. Plagas Asociadas (Plagas que amenazan al cultivo)
      Crop.belongsToMany(models.Plague, {
        through: 'CropPlagues',
        foreignKey: 'crop_id',
        otherKey: 'plague_id',
        as: 'plagues',
      });

      // 4. Agroquímicos Compatibles (Productos aprobados)
      Crop.belongsToMany(models.Product, {
        through: 'CropProducts',
        foreignKey: 'crop_id',
        otherKey: 'product_id',
        as: 'products',
      });
    }
  }

  Crop.init(
    {
      // 1. IDENTIFICACIÓN Y CLASIFICACIÓN (Catálogo Base)
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      common_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      scientific_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },

      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      family: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      botanical_family: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      genus: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      variety: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      // 2. FICHA TÉCNICA AGRONÓMICA
      growth_cycle: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      planting_season: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      soil_requirements: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      water_requirements: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      optimal_climate: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // 3. REGIÓN Y DISTRIBUCIÓN
      region: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      state: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      min_altitude: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      max_altitude: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // 4. CONDICIONES CLIMÁTICAS
      climate: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      min_temperature: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },

      max_temperature: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
      },

      min_rainfall: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      max_rainfall: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      humidity: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      // 5. CARACTERÍSTICAS DEL SUELO
      soil_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      ph_range: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      drainage: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      organic_matter: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      // 6. CICLO Y PRODUCCIÓN
      season: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      cycle: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      harvest_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      average_yield: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      planting_density: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      planting_depth: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // 7. REQUERIMIENTOS HÍDRICOS Y LUMINOSOS
      water_requirement: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      irrigation_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      sunlight_requirement: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // 8. FERTILIZACIÓN Y MANEJO
      nutrients: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      fertilization: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      requires_pruning: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },

      pollination_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // 9. INFORMACIÓN ADICIONAL
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      observations: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      // 10. ESTADO DEL CULTIVO (ENUM 'aprobado' | 'pendiente')
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'pendiente',
      },
    },
    {
      sequelize,
      modelName: 'Crop',
      tableName: 'Crops',
      timestamps: true,
    },
  );

  return Crop;
};
