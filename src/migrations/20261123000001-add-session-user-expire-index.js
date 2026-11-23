import {
  dropConcurrentIndex,
  ensureValidConcurrentIndex,
} from '../utils/concurrentIndexHelper.js';

export const SESSION_USER_EXPIRE_INDEX_NAME = 'idx_session_user_expire_desc';

export const SESSION_USER_EXPIRE_INDEX = Object.freeze({
  name: SESSION_USER_EXPIRE_INDEX_NAME,
  table: 'session',
  createSql:
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_session_user_expire_desc" ON "session" (((sess -> \'passport\' ->> \'user\')), "expire" DESC)',
});

export default {
  async up(queryInterface) {
    await ensureValidConcurrentIndex(queryInterface, SESSION_USER_EXPIRE_INDEX);
  },

  async down(queryInterface) {
    await dropConcurrentIndex(queryInterface, SESSION_USER_EXPIRE_INDEX_NAME);
  },
};
