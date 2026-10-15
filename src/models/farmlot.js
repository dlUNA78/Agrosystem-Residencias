import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class FarmLot extends Model {
    static associate(models) {
      FarmLot.belongsTo(models.Farm, {
        foreignKey: 'farm_id',
        as: 'farm',
      });
    }
  }

  FarmLot.init(
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      farm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      size_hectares: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'FarmLot',
      tableName: 'FarmLots',
    },
  );

  return FarmLot;
};
