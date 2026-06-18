'use strict';
const {
  Model
} = require('sequelize');
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
    nombre: DataTypes.STRING,
    contacto: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Supplier',
  });
  return Supplier;
};