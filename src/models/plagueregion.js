import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class PlagueRegion extends Model {
    static associate(models) {
      // Define associations here if needed
    }
  }

  PlagueRegion.init({
    plague_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    region_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    risk_level: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'PlagueRegion',
  });

  return PlagueRegion;
};
