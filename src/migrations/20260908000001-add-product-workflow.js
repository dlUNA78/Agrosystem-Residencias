const workflowColumns = [
  'created_by_user_id',
  'updated_by_user_id',
  'verified_by_user_id',
  'published_by_user_id',
];

export default {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'Products',
        'workflow_status',
        {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'draft',
        },
        { transaction },
      );

      for (const column of workflowColumns) {
        await queryInterface.addColumn(
          'Products',
          column,
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

      for (const column of ['verified_at', 'published_at']) {
        await queryInterface.addColumn(
          'Products',
          column,
          { type: Sequelize.DATE, allowNull: true },
          { transaction },
        );
      }
      await queryInterface.addColumn(
        'Products',
        'review_notes',
        { type: Sequelize.TEXT, allowNull: true },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `UPDATE "Products" SET "workflow_status" = CASE WHEN "status" = FALSE THEN 'archived' WHEN LOWER(TRIM("validation_status")) IN ('aprobado', 'validado') THEN 'published' ELSE 'draft' END`,
        { transaction },
      );
      await queryInterface.addIndex('Products', ['workflow_status'], {
        name: 'products_workflow_status_idx',
        transaction,
      });
      await queryInterface.addIndex('Products', ['created_by_user_id'], {
        name: 'products_created_by_user_idx',
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex(
        'Products',
        'products_created_by_user_idx',
        { transaction },
      );
      await queryInterface.removeIndex(
        'Products',
        'products_workflow_status_idx',
        { transaction },
      );
      for (const column of [
        'review_notes',
        'published_at',
        'verified_at',
        ...workflowColumns.toReversed(),
        'workflow_status',
      ]) {
        await queryInterface.removeColumn('Products', column, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
