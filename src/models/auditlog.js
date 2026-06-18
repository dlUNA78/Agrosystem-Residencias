import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class AuditLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  AuditLog.init({
    action: DataTypes.STRING,
    table_name: DataTypes.STRING,
    record_id: DataTypes.INTEGER,
    old_values: DataTypes.JSONB,
    new_values: DataTypes.JSONB,
    user_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'AuditLog',
  });
  return AuditLog;
};