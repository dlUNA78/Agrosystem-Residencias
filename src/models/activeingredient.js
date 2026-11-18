import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class ActiveIngredient extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ActiveIngredient.belongsTo(models.User, {
        foreignKey: 'created_by_user_id',
        as: 'createdBy',
      });
      ActiveIngredient.belongsTo(models.User, {
        foreignKey: 'updated_by_user_id',
        as: 'updatedBy',
      });
      ActiveIngredient.belongsTo(models.User, {
        foreignKey: 'archive_requested_by_user_id',
        as: 'archiveRequestedBy',
      });
      ActiveIngredient.belongsTo(models.User, {
        foreignKey: 'archived_by_user_id',
        as: 'archivedBy',
      });
    }
  }
  ActiveIngredient.init(
    {
      name: DataTypes.STRING,
      chemical_group: DataTypes.STRING,
      action_type: DataTypes.STRING,
      toxicological_category: DataTypes.STRING,
      workflow_status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'active',
      },
      created_by_user_id: DataTypes.INTEGER,
      updated_by_user_id: DataTypes.INTEGER,
      archive_reason_category: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      archive_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      archive_requested_by_user_id: DataTypes.INTEGER,
      archive_requested_at: DataTypes.DATE,
      archived_by_user_id: DataTypes.INTEGER,
      archived_at: DataTypes.DATE,
      archive_approval_notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'ActiveIngredient',
    },
  );
  return ActiveIngredient;
};
