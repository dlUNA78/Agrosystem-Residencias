import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class HealthReport extends Model {
    static associate(models) {
      HealthReport.belongsTo(models.Farm, {
        foreignKey: 'farm_id',
        as: 'farm',
      });
      HealthReport.belongsTo(models.FarmCrop, {
        foreignKey: 'farm_crop_id',
        as: 'farmCrop',
      });
    }
  }

  HealthReport.init(
    {
      farm_id: DataTypes.INTEGER,
      farm_crop_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      etapa_nombre: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      plaga_nombre: DataTypes.STRING,
      severidad: DataTypes.STRING,
      descripcion: DataTypes.TEXT,
      status: DataTypes.STRING,
      reporter_name: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'HealthReport',
    },
  );

  return HealthReport;
};
