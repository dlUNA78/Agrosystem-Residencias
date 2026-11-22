import 'dotenv/config';
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import db from '../../src/models/index.js';
import {
  dropConcurrentIndex,
  ensureValidConcurrentIndex,
  getIndexValidityState,
} from '../../src/utils/concurrentIndexHelper.js';
import { CORE_PERFORMANCE_INDEXES } from '../../src/migrations/20261121000001-add-core-performance-indexes.js';

const { sequelize } = db;

describe('concurrentIndexHelper (detección y recuperación de índices INVALID)', () => {
  it('omite la recreación si el índice ya existe y es válido (indisvalid = true)', async () => {
    const query = jest.fn(async () => [
      [{ index_name: 'idx_demo', indisvalid: true, indisready: true }],
    ]);
    const qi = { sequelize: { query } };

    const result = await ensureValidConcurrentIndex(qi, {
      name: 'idx_demo',
      createSql: 'CREATE INDEX CONCURRENTLY "idx_demo" ON "Farms" ("id")',
    });

    expect(result).toEqual({ name: 'idx_demo', action: 'skipped_valid' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('detecta pg_index.indisvalid = false, borra CONCURRENTLY y recrea el índice', async () => {
    const executedSql = [];
    let stateCalls = 0;
    const query = jest.fn(async (sql) => {
      executedSql.push(sql);
      if (sql.includes('FROM pg_index')) {
        stateCalls += 1;
        if (stateCalls === 1) {
          return [
            [{ index_name: 'idx_broken', indisvalid: false, indisready: true }],
          ];
        }
        return [
          [{ index_name: 'idx_broken', indisvalid: true, indisready: true }],
        ];
      }
      return [[]];
    });
    const qi = { sequelize: { query } };

    const result = await ensureValidConcurrentIndex(qi, {
      name: 'idx_broken',
      createSql:
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_broken" ON "AuditLogs" ("createdAt" DESC)',
    });

    expect(result).toEqual({
      name: 'idx_broken',
      action: 'recreated_from_invalid',
    });
    expect(executedSql[1]).toBe(
      'DROP INDEX CONCURRENTLY IF EXISTS "public"."idx_broken"',
    );
    expect(executedSql[2]).toContain('CREATE INDEX CONCURRENTLY');
    expect(stateCalls).toBe(2);
  });

  it('lanza error si el índice permanece inválido tras la creación', async () => {
    let stateCalls = 0;
    const query = jest.fn(async (sql) => {
      if (sql.includes('FROM pg_index')) {
        stateCalls += 1;
        if (stateCalls === 1) return [[]];
        return [
          [{ index_name: 'idx_bad', indisvalid: false, indisready: false }],
        ];
      }
      return [[]];
    });
    const qi = { sequelize: { query } };

    await expect(
      ensureValidConcurrentIndex(qi, {
        name: 'idx_bad',
        createSql: 'CREATE INDEX CONCURRENTLY "idx_bad" ON "Farms" ("id")',
      }),
    ).rejects.toThrow(/inválido/);
  });

  it('rechaza identificadores SQL inseguros en helpers concurrentes', async () => {
    const qi = { sequelize: { query: jest.fn() } };
    await expect(
      getIndexValidityState(qi, 'idx_bad; DROP TABLE "Users"'),
    ).rejects.toThrow(/Identificador SQL inválido/);
    await expect(dropConcurrentIndex(qi, 'bad-name-with-dash')).rejects.toThrow(
      /Identificador SQL inválido/,
    );
    expect(qi.sequelize.query).not.toHaveBeenCalled();
  });
});

describe('Esquema de índices de rendimiento (1.A3 + 1.A12)', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('verifica que todos los índices de 1.A3 y 1.A12 existen y tienen indisvalid = true en pg_index', async () => {
    const expectedIndexes = [
      ...CORE_PERFORMANCE_INDEXES.map((spec) => ({
        name: spec.name,
        table: spec.table,
      })),
      { name: 'idx_farms_user_status_created_id_desc', table: 'Farms' },
    ];

    const [rows] = await sequelize.query(
      `SELECT t.relname AS table_name,
              i.relname AS index_name,
              ix.indisvalid,
              ix.indisready,
              pg_get_indexdef(i.oid) AS index_def
       FROM pg_index ix
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND i.relname = ANY(ARRAY[:names]::text[])`,
      {
        replacements: { names: expectedIndexes.map((item) => item.name) },
      },
    );

    const byName = new Map(rows.map((r) => [r.index_name, r]));

    for (const expected of expectedIndexes) {
      const found = byName.get(expected.name);
      expect(found).toBeDefined();
      expect(found.table_name).toBe(expected.table);
      expect(found.indisvalid).toBe(true);
      expect(found.indisready).toBe(true);
    }

    const partialAlertIdx = byName.get(
      'idx_farm_health_reports_open_severity_created',
    );
    expect(partialAlertIdx.index_def).toMatch(
      /WHERE \(\(status\)::text = 'open'::text\)/,
    );
  });

  it('confirma que no existe ningún índice INVALID (indisvalid = false) en el esquema public', async () => {
    const [invalidRows] = await sequelize.query(`
      SELECT t.relname AS table_name, i.relname AS index_name
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND ix.indisvalid = false
    `);

    expect(invalidRows).toEqual([]);
  });

  it('mantiene la migración aditiva, sin duplicar 1.A12 ni crear índices descartados', async () => {
    const [allRows] = await sequelize.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);

    const indexNames = new Set(allRows.map((r) => r.indexname));

    // No duplica índice compuesto de Farms (1.A12)
    const farmSecondaryIndexes = allRows.filter(
      (r) => r.tablename === 'Farms' && r.indexname !== 'Farms_pkey',
    );
    expect(farmSecondaryIndexes.map((r) => r.indexname)).toEqual([
      'idx_farms_user_status_created_id_desc',
    ]);

    // Índices descartados/diferidos por evidencia no deben existir
    expect(indexNames.has('idx_audit_logs_table_created_at_desc')).toBe(false);
    expect(indexNames.has('idx_plagues_workflow_status')).toBe(false);
    expect(indexNames.has('idx_plagues_created_by_user')).toBe(false);
    expect(indexNames.has('idx_farm_lots_farm_id')).toBe(false);

    // Migración aditiva: conserva índices previos de Notifications (limpieza queda para 1.A15)
    expect(indexNames.has('idx_notifications_user_id')).toBe(true);
    expect(indexNames.has('idx_notifications_user_unread')).toBe(true);
    expect(indexNames.has('idx_notifications_created_at')).toBe(true);
  });
});
