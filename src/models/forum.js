'use strict';
const {
  Model
} = require('sequelize');
export default (sequelize, DataTypes) => {
  class Forum extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Forum.init({
    titulo: DataTypes.STRING,
    contenido: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Forum',
  });
  return Forum;
};