import {
  dropConcurrentIndex,
  ensureValidConcurrentIndex,
} from '../utils/concurrentIndexHelper.js';

export const REMOVED_REDUNDANT_INDEXES = Object.freeze([
  {
    name: 'inifap_codes_code',
    table: 'InifapCodes',
    reason:
      'Redundante con la restricción UNIQUE "InifapCodes_code_key" (code)',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "inifap_codes_code" ON "InifapCodes" ("code")',
  },
  {
    name: 'idx_rbac_roles_slug',
    table: 'RbacRoles',
    reason: 'Redundante con la restricción UNIQUE "RbacRoles_slug_key" (slug)',
    createSql:
      'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "idx_rbac_roles_slug" ON "RbacRoles" ("slug")',
  },
  {
    name: 'idx_notifications_user_id',
    table: 'Notifications',
    reason:
      'Prefijo estricto redundante de "idx_notifications_user_read_created_desc" (user_id, is_read ASC, "createdAt" DESC)',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_user_id" ON "Notifications" ("user_id")',
  },
  {
    name: 'idx_notifications_user_unread',
    table: 'Notifications',
    reason:
      'Prefijo estricto redundante de "idx_notifications_user_read_created_desc" (user_id, is_read ASC, "createdAt" DESC)',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_user_unread" ON "Notifications" ("user_id", "is_read")',
  },
]);

export default {
  async up(queryInterface) {
    for (const indexSpec of REMOVED_REDUNDANT_INDEXES) {
      await dropConcurrentIndex(queryInterface, indexSpec.name);
    }
  },

  async down(queryInterface) {
    for (const indexSpec of [...REMOVED_REDUNDANT_INDEXES].reverse()) {
      await ensureValidConcurrentIndex(queryInterface, indexSpec);
    }
  },
};
