import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Forum extends Model {
    static associate(models) {
      // Relaciones aquí
      Forum.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }
  }

  Forum.init(
    {
      title: DataTypes.STRING,
      content: DataTypes.TEXT,
      category: DataTypes.STRING,
      image_url: DataTypes.STRING,
      user_id: DataTypes.INTEGER
    },
    {
      sequelize,
      modelName: 'Forum',
      tableName: 'forums',
      timestamps: true
    }
  );

  return Forum;
};
