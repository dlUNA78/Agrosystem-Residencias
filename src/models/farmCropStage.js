import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class FarmCropStage extends Model {
    static associate(models) {
      FarmCropStage.belongsTo(models.FarmCrop, {
        foreignKey: 'farm_crop_id',
        as: 'farmCrop',
      });
    }
  }

  FarmCropStage.init(
    {
      farm_crop_id: { type: DataTypes.INTEGER, allowNull: false },
      stage_name: { type: DataTypes.STRING(150), allowNull: false },
      stage_order: { type: DataTypes.INTEGER, allowNull: false },
      estimated_date: DataTypes.DATEONLY,
      actual_date: DataTypes.DATEONLY,
      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'pending',
      },
      notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'FarmCropStage',
      tableName: 'FarmCropStages',
    },
  );

  return FarmCropStage;
};
