// src/models/InifapCode.js
import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class InifapCode extends Model {

    // ── Métodos de instancia ────────────────────────────────────────────────

    /**
     * Verifica si el código está disponible para ser canjeado.
     * Comprueba que no esté marcado como usado y que no haya expirado.
     */
    isAvailable() {
      if (this.is_used) return false;
      if (this.expires_at && new Date() > this.expires_at) return false;
      return true;
    }

    /**
     * "Quema" el código: lo marca como usado y registra quién y cuándo.
     * Acepta `options` para participar en una transacción externa.
     * @param {number} userId  - ID del usuario que canjea el código
     * @param {object} options - ej: { transaction: t }
     */
    async burn(userId, options = {}) {
      this.is_used = true;
      this.used_by_user_id = userId;
      this.used_at = new Date();
      return await this.save(options);
    }

    // ── Métodos estáticos ───────────────────────────────────────────────────

    /**
     * Busca un código disponible (no usado y no expirado).
     * Devuelve null si no existe o no está disponible.
     * @param {string} code
     * @returns {Promise<InifapCode|null>}
     */
    static async findAvailable(code) {
      const record = await InifapCode.findOne({ where: { code } });
      if (!record || !record.isAvailable()) return null;
      return record;
    }
  }

  InifapCode.init(
    {
      // El código alfanumérico que se entrega al empleado INIFAP
      // Ej: "INIFAP-A3K9-7ZP2"
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: { msg: "El código no puede estar vacío." },
        },
      },

      // true = ya fue canjeado (quemado), false = disponible
      is_used: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // FK al usuario que lo canjeó (null hasta que se use)
      used_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      // Fecha exacta del canje (auditoría)
      used_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Opcional: fecha límite para canjear el código
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      // Nota interna del admin al generar el código
      // Ej: "Para Dr. Juan Pérez - Centro Michoacán"
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "InifapCode",
    }
  );

  // ── Asociaciones ──────────────────────────────────────────────────────────
  InifapCode.associate = (models) => {
    // Un código pertenece al usuario que lo canjeó
    InifapCode.belongsTo(models.User, {
      foreignKey: "used_by_user_id",
      as: "usedBy",
    });
  };

  return InifapCode;
};