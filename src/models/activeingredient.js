export default (sequelize, DataTypes) => {
  class ActiveIngredient extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ActiveIngredient.init(
    {
      name: DataTypes.STRING,
      chemical_group: DataTypes.STRING,
      action_type: DataTypes.STRING,
      toxicological_category: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "ActiveIngredient",
    },
  );
  return ActiveIngredient;
};
