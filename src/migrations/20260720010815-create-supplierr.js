export default {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable("suppliers", {
      // ID
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      // DATOS DE LA EMPRESA
      name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      commercial_name: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      rfc: {
        type: Sequelize.STRING(13),
        allowNull: false,
        unique: true
      },

      supply_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },


      // =====================================
      // DATOS DE CONTACTO
      // =====================================

      contact_name: {
        type: Sequelize.STRING(120),
        allowNull: false
      },

      contact_position: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      email: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      alternative_email: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      phone: {
        type: Sequelize.STRING(30),
        allowNull: false
      },

      alternative_phone: {
        type: Sequelize.STRING(30),
        allowNull: true
      },


      // =====================================
      // UBICACIÓN
      // =====================================

      address: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      state: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      postal_code: {
        type: Sequelize.STRING(10),
        allowNull: false
      },

      country: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "México"
      },


      // =====================================
      // INFORMACIÓN DEL SUMINISTRO
      // =====================================

      supplied_products: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      brands: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      delivery_time: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      minimum_order: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },


      // =====================================
      // INFORMACIÓN COMERCIAL
      // =====================================

      payment_method: {
        type: Sequelize.STRING(100),
        allowNull: true
      },


      // =====================================
      // CONTROL
      // =====================================

      status: {
        type: Sequelize.ENUM(
          "activo",
          "pendiente",
          "inactivo"
        ),
        allowNull: false,
        defaultValue: "pendiente"
      },


      // =====================================
      // FECHAS
      // =====================================

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }

    });

  },


  async down(queryInterface) {

    await queryInterface.dropTable("suppliers");

  }

};