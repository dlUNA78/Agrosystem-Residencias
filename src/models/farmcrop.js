import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class FarmCrop extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      FarmCrop.belongsTo(models.Farm, { foreignKey: 'farm_id', as: 'farm' });
      FarmCrop.belongsTo(models.Crop, { foreignKey: 'crop_id', as: 'crop' });
      FarmCrop.hasMany(models.FarmCropProgress, {
        foreignKey: 'farm_crop_id',
        as: 'progressStages',
        onDelete: 'CASCADE',
      });
    }
  }
  FarmCrop.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      farm_id: DataTypes.INTEGER,
      crop_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      custom_crop_name: DataTypes.STRING,
      area_section: DataTypes.STRING,
      planting_date: DataTypes.DATE,
      is_active: DataTypes.BOOLEAN,
      status: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'FarmCrop',
    },
  );
  return FarmCrop;
};
