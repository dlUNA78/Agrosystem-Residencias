export default {

  async up(queryInterface, Sequelize) {

    await queryInterface.createTable("CropImages", {

      // ID DE LA IMAGEN
      id: {

        type: Sequelize.INTEGER,

        allowNull: false,

        autoIncrement: true,

        primaryKey: true,

      },


      // CULTIVO AL QUE PERTENECE
      crop_id: {

        type: Sequelize.INTEGER,

        allowNull: false,

        references: {

          model: "Crops",

          key: "id",

        },

        onUpdate: "CASCADE",

        onDelete: "CASCADE",

      },


      // RUTA DE LA IMAGEN
      image_url: {

        type: Sequelize.STRING(255),

        allowNull: false,

      },


      // NOMBRE ORIGINAL DEL ARCHIVO
      original_name: {

        type: Sequelize.STRING(255),

        allowNull: true,

      },


      // IMAGEN PRINCIPAL
      is_primary: {

        type: Sequelize.BOOLEAN,

        allowNull: false,

        defaultValue: false,

      },


      // ORDEN DE LA IMAGEN
      display_order: {

        type: Sequelize.INTEGER,

        allowNull: false,

        defaultValue: 0,

      },


      // FECHAS
      createdAt: {

        type: Sequelize.DATE,

        allowNull: false,

      },

      updatedAt: {

        type: Sequelize.DATE,

        allowNull: false,

      },

    });

  },


  async down(queryInterface) {

    await queryInterface.dropTable("CropImages");

  },

};