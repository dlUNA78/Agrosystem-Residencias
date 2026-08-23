import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class FarmCropProgress extends Model {
    static associate(models) {
      FarmCropProgress.belongsTo(models.FarmCrop, {
        foreignKey: 'farm_crop_id',
        as: 'farmCrop',
      });
    }
  }

  FarmCropProgress.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      farm_crop_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      stage_name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },
      stage_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      estimated_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      real_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Pendiente',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'FarmCropProgress',
      tableName: 'FarmCropProgresses',
      timestamps: true,
    },
  );

  return FarmCropProgress;
};
