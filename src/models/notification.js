import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
      Notification.belongsTo(models.User, {
        foreignKey: 'actor_id',
        as: 'actor',
      });
    }
  }

  Notification.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      actor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'sistema',
      },
      severity: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'info',
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      action_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'Notifications',
    },
  );

  return Notification;
};
