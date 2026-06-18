import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  User.init({
    code: DataTypes.STRING,
    full_name: DataTypes.STRING,
    email: DataTypes.STRING,
    password_hash: DataTypes.STRING,
    role: DataTypes.STRING,
    phone: DataTypes.STRING,
    address: DataTypes.TEXT,
    job_title: DataTypes.STRING,
    shift: DataTypes.STRING,
    photo_url: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};