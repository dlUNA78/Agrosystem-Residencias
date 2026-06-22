import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Supplier extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  Supplier.init({
    name: DataTypes.STRING,
    rfc: DataTypes.STRING,
    contact_name: DataTypes.STRING,
    email: DataTypes.STRING,
    phone: DataTypes.STRING,
    supply_type: DataTypes.STRING,
    address: DataTypes.STRING,
    status: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Supplier',
  });

  return Supplier;
};