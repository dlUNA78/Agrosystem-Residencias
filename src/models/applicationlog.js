import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class ApplicationLog extends Model {
    static associate(models) {
      ApplicationLog.belongsTo(models.Farm, {
        foreignKey: 'farm_id',
        as: 'farm',
      });
      ApplicationLog.belongsTo(models.FarmCrop, {
        foreignKey: 'farm_crop_id',
        as: 'farmCrop',
      });
    }
  }

  ApplicationLog.init(
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
      producto_nombre: DataTypes.STRING,
      ingrediente_activo: DataTypes.STRING,
      dosis: DataTypes.STRING,
      fecha_aplicacion: DataTypes.DATE,
      notas: DataTypes.TEXT,
      applicator_name: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'ApplicationLog',
    },
  );

  return ApplicationLog;
};
