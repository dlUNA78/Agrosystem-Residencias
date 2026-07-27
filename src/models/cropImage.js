import { Model } from "sequelize";

export default (sequelize, DataTypes) => {

  class CropImage extends Model {

    static associate(models) {

      // Cada imagen pertenece a un cultivo
      CropImage.belongsTo(models.Crop, {

        foreignKey: "crop_id",

        as: "crop",

      });

    }

  }


  CropImage.init({

    // ID DEL CULTIVO
    crop_id: {

      type: DataTypes.INTEGER,

      allowNull: false,

    },


    // RUTA DE LA IMAGEN
    image_url: {

      type: DataTypes.STRING(255),

      allowNull: false,

    },


    // NOMBRE ORIGINAL DEL ARCHIVO
    original_name: {

      type: DataTypes.STRING(255),

      allowNull: true,

    },


    // IMAGEN PRINCIPAL
    is_primary: {

      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: false,

    },


    // ORDEN DE LA IMAGEN
    display_order: {

      type: DataTypes.INTEGER,

      allowNull: false,

      defaultValue: 0,

    },

  }, {

    sequelize,

    modelName: "CropImage",

    tableName: "CropImages",

    timestamps: true,

  });


  return CropImage;

};