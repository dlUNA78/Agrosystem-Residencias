import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class HealthReport extends Model {
    static associate(models) {
      HealthReport.belongsTo(models.Farm, {
        foreignKey: 'farm_id',
        as: 'farm',
      });
    }
  }

  HealthReport.init(
    {
      farm_id: DataTypes.INTEGER,
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
