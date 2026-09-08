import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class FarmApplication extends Model {
    static associate(models) {
      FarmApplication.belongsTo(models.Farm, {
        foreignKey: 'farm_id',
        as: 'farm',
      });
      FarmApplication.belongsTo(models.FarmCrop, {
        foreignKey: 'farm_crop_id',
        as: 'farmCrop',
      });
      FarmApplication.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product',
      });
      FarmApplication.belongsTo(models.User, {
        foreignKey: 'created_by_user_id',
        as: 'createdBy',
      });
    }
  }

  FarmApplication.init(
    {
      farm_id: { type: DataTypes.INTEGER, allowNull: false },
      farm_crop_id: DataTypes.INTEGER,
      product_id: DataTypes.INTEGER,
      product_name: { type: DataTypes.STRING(200), allowNull: false },
      active_ingredient: DataTypes.STRING(200),
      dose_value: { type: DataTypes.DECIMAL(10, 3), allowNull: false },
      dose_unit: { type: DataTypes.STRING(20), allowNull: false },
      applied_at: { type: DataTypes.DATEONLY, allowNull: false },
      notes: DataTypes.TEXT,
      created_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize,
      modelName: 'FarmApplication',
      tableName: 'FarmApplications',
    },
  );

  return FarmApplication;
};
