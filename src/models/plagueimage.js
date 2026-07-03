import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class PlagueImage extends Model {
    static associate(models) {
      PlagueImage.belongsTo(models.Plague, {
        foreignKey: "plague_id",
        as: "plague",
      });
    }
  }

  PlagueImage.init(
    {
      plague_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      caption: DataTypes.STRING,
      source: DataTypes.STRING,
      sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "PlagueImage",
      tableName: "PlagueImages",
    }
  );

  return PlagueImage;
};
