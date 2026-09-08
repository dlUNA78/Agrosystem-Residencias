import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class FarmHealthReport extends Model {
    static associate(models) {
      FarmHealthReport.belongsTo(models.Farm, {
        foreignKey: 'farm_id',
        as: 'farm',
      });
      FarmHealthReport.belongsTo(models.FarmCrop, {
        foreignKey: 'farm_crop_id',
        as: 'farmCrop',
      });
      FarmHealthReport.belongsTo(models.Plague, {
        foreignKey: 'plague_id',
        as: 'plague',
      });
      FarmHealthReport.belongsTo(models.User, {
        foreignKey: 'created_by_user_id',
        as: 'createdBy',
      });
    }
  }

  FarmHealthReport.init(
    {
      farm_id: { type: DataTypes.INTEGER, allowNull: false },
      farm_crop_id: DataTypes.INTEGER,
      plague_id: DataTypes.INTEGER,
      plague_name: { type: DataTypes.STRING(200), allowNull: false },
      severity: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'low',
      },
      description: DataTypes.TEXT,
      observed_at: { type: DataTypes.DATEONLY, allowNull: false },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'open',
      },
      created_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize,
      modelName: 'FarmHealthReport',
      tableName: 'FarmHealthReports',
    },
  );

  return FarmHealthReport;
};
