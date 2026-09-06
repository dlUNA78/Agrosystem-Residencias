export default {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        'Crops',
        'workflow_status',
        {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'draft',
        },
        { transaction },
      );

      for (const column of [
        'created_by_user_id',
        'updated_by_user_id',
        'verified_by_user_id',
        'published_by_user_id',
      ]) {
        await queryInterface.addColumn(
          'Crops',
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

      await queryInterface.addColumn(
        'Crops',
        'verified_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'Crops',
        'published_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'Crops',
        'review_notes',
        { type: Sequelize.TEXT, allowNull: true },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `UPDATE "Crops" SET "workflow_status" = CASE WHEN LOWER(TRIM("status")) = 'aprobado' THEN 'published' WHEN LOWER(TRIM("status")) = 'rechazado' THEN 'archived' ELSE 'draft' END`,
        { transaction },
      );

      await queryInterface.addIndex('Crops', ['workflow_status'], {
        name: 'crops_workflow_status_idx',
        transaction,
      });
      await queryInterface.addIndex('Crops', ['created_by_user_id'], {
        name: 'crops_created_by_user_idx',
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
      await queryInterface.removeIndex('Crops', 'crops_created_by_user_idx', {
        transaction,
      });
      await queryInterface.removeIndex('Crops', 'crops_workflow_status_idx', {
        transaction,
      });

      for (const column of [
        'review_notes',
        'published_at',
        'verified_at',
        'published_by_user_id',
        'verified_by_user_id',
        'updated_by_user_id',
        'created_by_user_id',
      ]) {
        await queryInterface.removeColumn('Crops', column, { transaction });
      }

      await queryInterface.removeColumn('Crops', 'workflow_status', {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
