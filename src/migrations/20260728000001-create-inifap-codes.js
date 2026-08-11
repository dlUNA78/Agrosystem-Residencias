'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('InifapCodes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // El código alfanumérico que se le entrega al empleado INIFAP
      // Ej: "INIFAP-2026-X7K2" — generado por el admin
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      // Una vez canjeado, se convierte en true (quemado)
      is_used: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // Referencia al usuario que lo canjeó (null hasta que se use)
      used_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // Fecha exacta en que fue canjeado (auditoría)
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Opcional: fecha de expiración para códigos con ventana de tiempo
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Nota interna del admin al generar el código
      // Ej: "Para Dr. Juan Pérez - Centro Michoacán"
      note: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Índice para búsquedas rápidas por código (el caso más frecuente)
    await queryInterface.addIndex('InifapCodes', ['code']);

    // Índice para auditoría: ver qué códigos ya fueron usados
    await queryInterface.addIndex('InifapCodes', ['is_used']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('InifapCodes');
  },
};