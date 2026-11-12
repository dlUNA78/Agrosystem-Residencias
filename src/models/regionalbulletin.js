import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class RegionalBulletin extends Model {
    static associate(models) {
      if (models.Region) {
        RegionalBulletin.belongsTo(models.Region, {
          foreignKey: 'region_id',
          as: 'region',
        });
      }
      if (models.User) {
        RegionalBulletin.belongsTo(models.User, {
          foreignKey: 'created_by_user_id',
          as: 'createdBy',
        });
        RegionalBulletin.belongsTo(models.User, {
          foreignKey: 'published_by_user_id',
          as: 'publishedBy',
        });
      }
    }
  }

  RegionalBulletin.init(
    {
      folio: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      bulletin_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'aviso_semanal',
      },
      severity: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'MEDIA',
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      region_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      crop_name: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      plague_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      plague_scientific_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },
      workflow_status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'published',
      },
      created_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      published_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'RegionalBulletin',
      tableName: 'RegionalBulletins',
      timestamps: true,
    },
  );

  return RegionalBulletin;
};
