import { Model } from 'sequelize';
import { PLAGUE_WORKFLOW_STATUSES } from '../services/plagueWorkflowService.js';

export default (sequelize, DataTypes) => {
  class Plague extends Model {
    static associate(models) {
      // Una plaga tiene muchas imágenes de referencia (carrusel)
      Plague.hasMany(models.PlagueImage, {
        foreignKey: 'plague_id',
        as: 'images',
      });

      // Una plaga se relaciona con muchos productos (tabla pivote)
      Plague.belongsToMany(models.Product, {
        through: 'PlagueProducts',
        foreignKey: 'plague_id',
        otherKey: 'product_id',
        as: 'products',
      });

      // Una plaga se relaciona con muchas regiones
      Plague.belongsToMany(models.Region, {
        through: 'PlagueRegions',
        foreignKey: 'plague_id',
        otherKey: 'region_id',
        as: 'regions',
      });

      // Una plaga ataca a muchos cultivos (tabla pivote CropPlagues)
      Plague.belongsToMany(models.Crop, {
        through: 'CropPlagues',
        foreignKey: 'plague_id',
        otherKey: 'crop_id',
        as: 'crops',
      });

      Plague.belongsTo(models.User, {
        foreignKey: 'created_by_user_id',
        as: 'createdBy',
      });
      Plague.belongsTo(models.User, {
        foreignKey: 'updated_by_user_id',
        as: 'updatedBy',
      });
      Plague.belongsTo(models.User, {
        foreignKey: 'verified_by_user_id',
        as: 'verifiedByUser',
      });
      Plague.belongsTo(models.User, {
        foreignKey: 'published_by_user_id',
        as: 'publishedBy',
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
      symptoms: DataTypes.TEXT,
      control_methods: DataTypes.TEXT,
      biological_control: DataTypes.TEXT,
      biological_cycle: DataTypes.JSONB,
      verified_by: DataTypes.STRING,
      verified_at: DataTypes.DATE,
      workflow_status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: PLAGUE_WORKFLOW_STATUSES.DRAFT,
        validate: {
          isIn: [Object.values(PLAGUE_WORKFLOW_STATUSES)],
        },
      },
      created_by_user_id: DataTypes.INTEGER,
      updated_by_user_id: DataTypes.INTEGER,
      verified_by_user_id: DataTypes.INTEGER,
      published_by_user_id: DataTypes.INTEGER,
      published_at: DataTypes.DATE,
      review_notes: DataTypes.TEXT,
      is_monitoring_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: 'Plague',
    },
  );

  return Plague;
};
