import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.hasMany(models.AuditLog, {
        foreignKey: 'user_id',
        as: 'auditLogs',
      });
      User.belongsTo(models.RbacRole, {
        foreignKey: 'rbac_role_id',
        as: 'rbacRole',
      });
      User.hasMany(models.Notification, {
        foreignKey: 'user_id',
        as: 'notifications',
      });
      User.hasMany(models.InifapCode, {
        foreignKey: 'created_by_user_id',
        as: 'createdCodes',
      });
      User.hasMany(models.Farm, {
        foreignKey: 'user_id',
        as: 'farms',
      });
    }
  }
  User.init(
    {
      code: DataTypes.STRING,
      full_name: DataTypes.STRING,
      email: DataTypes.STRING,
      password_hash: DataTypes.STRING,
      role: DataTypes.STRING,
      phone: DataTypes.STRING,
      address: DataTypes.TEXT,
      job_title: DataTypes.STRING,
      shift: DataTypes.STRING,
      photo_url: DataTypes.TEXT,
      status: DataTypes.STRING,
      rbac_role_id: DataTypes.INTEGER,
      custom_permissions: {
        type: DataTypes.JSONB,
        defaultValue: { allow: [], deny: [] },
      },
    },
    {
      sequelize,
      modelName: 'User',
    },
  );
  return User;
};
