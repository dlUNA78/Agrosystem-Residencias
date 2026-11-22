import {
  dropConcurrentIndex,
  ensureValidConcurrentIndex,
} from '../utils/concurrentIndexHelper.js';

export const CORE_PERFORMANCE_INDEXES = Object.freeze([
  {
    name: 'idx_audit_logs_created_at_desc',
    table: 'AuditLogs',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_created_at_desc" ON "AuditLogs" ("createdAt" DESC, "id" DESC)',
  },
  {
    name: 'idx_audit_logs_user_created_at_desc',
    table: 'AuditLogs',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_logs_user_created_at_desc" ON "AuditLogs" ("user_id", "createdAt" DESC)',
  },
  {
    name: 'idx_farm_crops_farm_id_active',
    table: 'FarmCrops',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_crops_farm_id_active" ON "FarmCrops" ("farm_id", "is_active")',
  },
  {
    name: 'idx_farm_crops_crop_id_active',
    table: 'FarmCrops',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_crops_crop_id_active" ON "FarmCrops" ("crop_id", "is_active")',
  },
  {
    name: 'idx_notifications_user_read_created_desc',
    table: 'Notifications',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_notifications_user_read_created_desc" ON "Notifications" ("user_id", "is_read" ASC, "createdAt" DESC)',
  },
  {
    name: 'idx_farm_applications_farm_created_at',
    table: 'FarmApplications',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_applications_farm_created_at" ON "FarmApplications" ("farm_id", "createdAt" DESC)',
  },
  {
    name: 'idx_farm_applications_product_id',
    table: 'FarmApplications',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_applications_product_id" ON "FarmApplications" ("product_id")',
  },
  {
    name: 'idx_farm_health_reports_farm_created_at',
    table: 'FarmHealthReports',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_health_reports_farm_created_at" ON "FarmHealthReports" ("farm_id", "createdAt" DESC)',
  },
  {
    name: 'idx_farm_health_reports_open_severity_created',
    table: 'FarmHealthReports',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_health_reports_open_severity_created" ON "FarmHealthReports" ("severity", "createdAt" DESC) WHERE "status" = \'open\'',
  },
  {
    name: 'idx_farm_health_reports_plague_status',
    table: 'FarmHealthReports',
    createSql:
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_farm_health_reports_plague_status" ON "FarmHealthReports" ("plague_id", "status")',
  },
]);

export default {
  async up(queryInterface) {
    for (const indexSpec of CORE_PERFORMANCE_INDEXES) {
      await ensureValidConcurrentIndex(queryInterface, indexSpec);
    }
  },

  async down(queryInterface) {
    for (const indexSpec of [...CORE_PERFORMANCE_INDEXES].reverse()) {
      await dropConcurrentIndex(queryInterface, indexSpec.name);
    }
  },
};
