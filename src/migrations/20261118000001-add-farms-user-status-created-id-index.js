export default {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farms_user_status_created_id_desc" ON "Farms" ("user_id", "status", "createdAt" DESC, "id" DESC)',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX CONCURRENTLY IF EXISTS "idx_farms_user_status_created_id_desc"',
    );
  },
};
