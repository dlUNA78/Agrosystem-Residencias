import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class RbacRole extends Model {
    static associate(models) {
      RbacRole.hasMany(models.User, {
        foreignKey: 'rbac_role_id',
        as: 'users',
      });
      RbacRole.hasMany(models.InifapCode, {
        foreignKey: 'rbac_role_id',
        as: 'codes',
      });
    }
  }

  RbacRole.init(
    {
      slug: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      base_role: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'inifap',
      },
      badge_color: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'emerald',
      },
      permissions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        get() {
          const raw = this.getDataValue('permissions');
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'string') {
            try {
              return JSON.parse(raw);
            } catch {
              return [];
            }
          }
          return [];
        },
        set(val) {
          const list = Array.isArray(val)
            ? val
            : typeof val === 'string'
              ? [val]
              : [];
          this.setDataValue('permissions', list);
        },
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'RbacRole',
      tableName: 'RbacRoles',
    },
  );

  return RbacRole;
};
