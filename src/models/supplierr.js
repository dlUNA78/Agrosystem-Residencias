import { Model } from "sequelize";

export default (sequelize, DataTypes) => {

  class Supplier extends Model {

    static associate(models) {
      // Las asociaciones se agregarán después si son necesarias
    }

  }

  Supplier.init({

    // DATOS DE LA EMPRESA
    name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },

    commercial_name: {
      type: DataTypes.STRING(150),
      allowNull: true
    },

    rfc: {
      type: DataTypes.STRING(13),
      allowNull: false,
      unique: true
    },

    supply_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    // DATOS DE CONTACTO

    contact_name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },

    contact_position: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },

    alternative_email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },

    phone: {
      type: DataTypes.STRING(30),
      allowNull: false
    },

    alternative_phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },

    // UBICACIÓN
    address: {
      type: DataTypes.STRING(255),
      allowNull: false
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    state: {
      type: DataTypes.STRING(100),
      allowNull: false
    },

    postal_code: {
      type: DataTypes.STRING(10),
      allowNull: false
    },

    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "México"
    },
    // INFORMACIÓN DEL SUMINISTRO
   
    supplied_products: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    brands: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    delivery_time: {
      type: DataTypes.STRING(100),
      allowNull: true
    },

    minimum_order: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    // INFORMACIÓN COMERCIAL

    payment_method: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // CONTROL

    status: {
      type: DataTypes.ENUM(
        "activo",
        "pendiente",
        "inactivo"
      ),
      allowNull: false,
      defaultValue: "pendiente"
    }

  }, {

    sequelize,
    modelName: "Supplier",
    tableName: "suppliers",
    timestamps: true

  });

  return Supplier;
}; 