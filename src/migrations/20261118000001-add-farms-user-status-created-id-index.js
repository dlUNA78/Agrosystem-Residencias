import {
  dropConcurrentIndex,
  ensureValidConcurrentIndex,
} from '../utils/concurrentIndexHelper.js';

const INDEX_SPEC = {
  name: 'idx_farms_user_status_created_id_desc',
  createSql:
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farms_user_status_created_id_desc" ON "Farms" ("user_id", "status", "createdAt" DESC, "id" DESC)',
};

export default {
  async up(queryInterface) {
    await ensureValidConcurrentIndex(queryInterface, INDEX_SPEC);
  },

  async down(queryInterface) {
    await dropConcurrentIndex(queryInterface, INDEX_SPEC.name);
  },
};
