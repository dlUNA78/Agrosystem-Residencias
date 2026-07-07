import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Region extends Model {
    static associate(models) {
      Region.belongsToMany(models.Plague, {
        through: "PlagueRegions",
        foreignKey: "region_id",
        otherKey: "plague_id",
        as: "plagues"
      });
    }
  }

  Region.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    lat: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    lng: {
      type: DataTypes.FLOAT,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Region',
  });

  return Region;
};
