export default {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        'Plagues',
        'workflow_status',
        {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: 'draft',
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'Plagues',
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
      await queryInterface.addColumn(
        'Plagues',
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
      await queryInterface.addColumn(
        'Plagues',
        'verified_by_user_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'Plagues',
        'published_by_user_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'Plagues',
        'published_at',
        {
          type: Sequelize.DATE,
          allowNull: true,
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'Plagues',
        'review_notes',
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'Plagues',
        'is_monitoring_active',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        { transaction },
      );

      await queryInterface.sequelize.query(
        `UPDATE "Plagues" SET "workflow_status" = CASE WHEN "status" = TRUE AND NULLIF(TRIM("verified_by"), '') IS NOT NULL THEN 'published' WHEN "status" = TRUE THEN 'in_review' ELSE 'archived' END`,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeColumn('Plagues', 'is_monitoring_active', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'review_notes', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'published_at', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'published_by_user_id', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'verified_by_user_id', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'updated_by_user_id', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'created_by_user_id', {
        transaction,
      });
      await queryInterface.removeColumn('Plagues', 'workflow_status', {
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
