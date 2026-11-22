import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it, jest } from '@jest/globals';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import db from '../../src/models/index.js';
import {
  dropConcurrentIndex,
  ensureValidConcurrentIndex,
  getIndexValidityState,
} from '../../src/utils/concurrentIndexHelper.js';
import { CORE_PERFORMANCE_INDEXES } from '../../src/migrations/20261121000001-add-core-performance-indexes.js';
import { REMOVED_REDUNDANT_INDEXES } from '../../src/migrations/20261122000001-remove-duplicate-and-redundant-indexes.js';

const { sequelize, InifapCode, RbacRole } = db;

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
      { name: 'InifapCodes_code_key', table: 'InifapCodes' },
      { name: 'RbacRoles_slug_key', table: 'RbacRoles' },
      { name: 'idx_notifications_created_at', table: 'Notifications' },
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

  it('elimina los 4 índices redundantes (1.A15), conserva idx_notifications_created_at y no duplica 1.A12', async () => {
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

    // Índices descartados/diferidos por evidencia en 1.A3 no deben existir
    expect(indexNames.has('idx_audit_logs_table_created_at_desc')).toBe(false);
    expect(indexNames.has('idx_plagues_workflow_status')).toBe(false);
    expect(indexNames.has('idx_plagues_created_by_user')).toBe(false);
    expect(indexNames.has('idx_farm_lots_farm_id')).toBe(false);

    // 1.A15: los 4 índices redundantes fueron eliminados
    for (const removed of REMOVED_REDUNDANT_INDEXES) {
      expect(indexNames.has(removed.name)).toBe(false);
    }

    // 1.A15: se conservan los índices autoritativos y idx_notifications_created_at (para 3.A8)
    expect(indexNames.has('InifapCodes_code_key')).toBe(true);
    expect(indexNames.has('RbacRoles_slug_key')).toBe(true);
    expect(indexNames.has('idx_notifications_user_read_created_desc')).toBe(
      true,
    );
    expect(indexNames.has('idx_notifications_created_at')).toBe(true);
  });

  it('mantiene la restricción UNIQUE activa al insertar code duplicado en InifapCodes y slug duplicado en RbacRoles (1.A15)', async () => {
    const uniqueCode = `AGS-1A15-${Date.now()}`;
    const uniqueSlug = `rol-1a15-${Date.now()}`;

    try {
      await InifapCode.create({
        code: uniqueCode,
        is_used: false,
      });

      await expect(
        InifapCode.create({
          code: uniqueCode,
          is_used: false,
        }),
      ).rejects.toMatchObject({
        name: 'SequelizeUniqueConstraintError',
      });

      await RbacRole.create({
        slug: uniqueSlug,
        name: 'Rol Prueba Unicidad 1.A15',
        base_role: 'inifap',
        badge_color: 'emerald',
        permissions: [],
        is_system: false,
      });

      await expect(
        RbacRole.create({
          slug: uniqueSlug,
          name: 'Rol Duplicado 1.A15',
          base_role: 'inifap',
          badge_color: 'emerald',
          permissions: [],
          is_system: false,
        }),
      ).rejects.toMatchObject({
        name: 'SequelizeUniqueConstraintError',
      });
    } finally {
      await InifapCode.destroy({ where: { code: uniqueCode } });
      await RbacRole.destroy({ where: { slug: uniqueSlug } });
    }
  });

  it('confirma que PgSession mantiene activa la poda automática de sesiones expiradas (pruneSessionInterval por defecto)', async () => {
    const appPath = path.resolve(process.cwd(), 'app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');

    expect(appContent).toContain('new PgSession(');
    expect(appContent).not.toMatch(/pruneSessionInterval\s*:\s*false/);

    const PgSession = connectPgSimple(session);
    const mockPool = {
      query: jest.fn((_sql, _params, cb) => {
        if (typeof cb === 'function') cb(null, { rows: [] });
      }),
    };
    const store = new PgSession({
      pool: mockPool,
      createTableIfMissing: false,
    });

    try {
      await new Promise((resolve) => {
        store.get('sid-check-prune-timer', () => resolve());
      });
      expect(store.pruneTimer).toBeDefined();
    } finally {
      await store.close();
    }
  });
});
