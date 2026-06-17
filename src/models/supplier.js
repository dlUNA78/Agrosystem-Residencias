import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      // Relaciones aquí
    }
  }

  Supplier.init(
    {
      name: DataTypes.STRING,
      rfc: DataTypes.STRING,
      contact_name: DataTypes.STRING,
      email: DataTypes.STRING,
      phone: DataTypes.STRING,
      supply_type: DataTypes.STRING,
      address: DataTypes.STRING,
      status: DataTypes.STRING
    },
    {
      sequelize,
      modelName: 'Supplier',
    }
  );

  return Supplier;
};