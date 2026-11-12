// src/migrations/20261111000001-add-dual-approval-deactivation-workflow.js

const ARCHIVE_COLUMNS = [
  { name: 'archive_reason_category', def: (Sequelize) => ({ type: Sequelize.STRING(64), allowNull: true }) },
  { name: 'archive_reason', def: (Sequelize) => ({ type: Sequelize.TEXT, allowNull: true }) },
  {
    name: 'archive_requested_by_user_id',
    def: (Sequelize) => ({
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    }),
  },
  { name: 'archive_requested_at', def: (Sequelize) => ({ type: Sequelize.DATE, allowNull: true }) },
  {
    name: 'archived_by_user_id',
    def: (Sequelize) => ({
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    }),
  },
  { name: 'archived_at', def: (Sequelize) => ({ type: Sequelize.DATE, allowNull: true }) },
  { name: 'archive_approval_notes', def: (Sequelize) => ({ type: Sequelize.TEXT, allowNull: true }) },
];

export default {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = ['Crops', 'Plagues', 'Products'];

      for (const tableName of tables) {
        const tableDescription = await queryInterface.describeTable(tableName);
        for (const col of ARCHIVE_COLUMNS) {
          if (!tableDescription[col.name]) {
            await queryInterface.addColumn(tableName, col.name, col.def(Sequelize), { transaction });
          }
        }
      }

      const ingredientTable = await queryInterface.describeTable('ActiveIngredients');
      if (!ingredientTable.workflow_status) {
        await queryInterface.addColumn(
          'ActiveIngredients',
          'workflow_status',
          {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: 'active',
          },
          { transaction },
        );
      }
      if (!ingredientTable.created_by_user_id) {
        await queryInterface.addColumn(
          'ActiveIngredients',
          'created_by_user_id',
          {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          { transaction },
        );
      }
      if (!ingredientTable.updated_by_user_id) {
        await queryInterface.addColumn(
          'ActiveIngredients',
          'updated_by_user_id',
          {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          { transaction },
        );
      }

      for (const col of ARCHIVE_COLUMNS) {
        if (!ingredientTable[col.name]) {
          await queryInterface.addColumn('ActiveIngredients', col.name, col.def(Sequelize), { transaction });
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = ['Crops', 'Plagues', 'Products', 'ActiveIngredients'];

      for (const tableName of tables) {
        const tableDescription = await queryInterface.describeTable(tableName);
        for (const col of ARCHIVE_COLUMNS) {
          if (tableDescription[col.name]) {
            await queryInterface.removeColumn(tableName, col.name, { transaction });
          }
        }
      }

      const ingredientTable = await queryInterface.describeTable('ActiveIngredients');
      if (ingredientTable.workflow_status) {
        await queryInterface.removeColumn('ActiveIngredients', 'workflow_status', { transaction });
      }
      if (ingredientTable.created_by_user_id) {
        await queryInterface.removeColumn('ActiveIngredients', 'created_by_user_id', { transaction });
      }
      if (ingredientTable.updated_by_user_id) {
        await queryInterface.removeColumn('ActiveIngredients', 'updated_by_user_id', { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
