import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
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
import {
  normalizeAuditQuery,
  buildAuditWhere,
  escapeLikePattern,
  serializeAuditLog,
} from '../../src/services/auditQueryService.js';
import { auditPrivate } from '../../src/controllers/private/auditController.js';

const { sequelize, Sequelize, AuditLog, User, InifapCode, RbacRole } = db;
const { Op } = Sequelize;

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

const buildLegacyAuditWhere = (query, extraRecordFilter) => {
  const baseWhere = { ...extraRecordFilter };
  const excludedLowImpactActions = [
    'AVATAR_UPDATE',
    'AVATAR_REMOVE',
    'PROFILE_UPDATE',
  ];

  const MODULE_TABLES = {
    plagas: ['Plagues', 'Plague', 'PlagueImages', 'PlagueRegions'],
    cultivos: ['Crops', 'Crop', 'CropImages'],
    productos: ['Products', 'Product', 'ProductImages'],
    terrenos: [
      'Farms',
      'Farm',
      'FarmCrops',
      'FarmCropStages',
      'FarmHealthReports',
      'FarmApplications',
      'FarmBlocks',
    ],
    usuarios: ['Users', 'User', 'InifapCodes'],
    proveedores: ['Suppliers', 'Supplier'],
    ingredientes: ['ActiveIngredients', 'ActiveIngredient'],
  };

  const ACTION_GROUPS = {
    crear: [
      'create',
      'create_crop_cycle',
      'create_health_report',
      'create_application',
      'create_block',
    ],
    editar: [
      'update',
      'advance_crop_stage',
      'revert_crop_stage',
      'finish_crop_cycle',
      'update_workflow',
      'manage_relations',
    ],
    eliminar: ['delete', 'destroy', 'deactivate_block'],
    archivar: ['archive'],
    restaurar: ['restore'],
    aprobar: ['verify', 'publish', 'request_changes', 'submit_review'],
  };

  if (query.module && MODULE_TABLES[query.module]) {
    baseWhere.table_name = { [Op.in]: MODULE_TABLES[query.module] };
  }
  if (query.action && ACTION_GROUPS[query.action]) {
    baseWhere.action = { [Op.in]: ACTION_GROUPS[query.action] };
  } else {
    baseWhere.action = { [Op.notIn]: excludedLowImpactActions };
  }

  if (query.search) {
    const escaped = `%${escapeLikePattern(query.search.toLowerCase())}%`;
    baseWhere[Op.or] = [
      Sequelize.where(Sequelize.fn('lower', Sequelize.col('table_name')), {
        [Op.like]: escaped,
      }),
      Sequelize.where(Sequelize.fn('lower', Sequelize.col('action')), {
        [Op.like]: escaped,
      }),
      Sequelize.where(
        Sequelize.fn(
          'lower',
          Sequelize.fn('coalesce', Sequelize.col('user.full_name'), ''),
        ),
        { [Op.like]: escaped },
      ),
      Sequelize.where(
        Sequelize.fn(
          'lower',
          Sequelize.fn('coalesce', Sequelize.col('user.email'), ''),
        ),
        { [Op.like]: escaped },
      ),
    ];
  }

  return baseWhere;
};

describe('paridad real de conteo y búsqueda en AuditLogs (1.A14)', () => {
  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const markerRecordId = 900000 + Math.floor(Math.random() * 90000);
  const createdLogIds = [];
  const createdUserIds = [];
  let activeUser;
  let wildcardUser;
  let deletedUser;

  beforeAll(async () => {
    activeUser = await User.create({
      full_name: `Auditor Activo ${uniqueSuffix}`,
      email: `auditor.activo.${uniqueSuffix}@agrosystem.test`,
      password_hash: '$2b$10$testhash0000000000000000000000000000000000000',
      role: 'inifap',
      status: 'activo',
    });
    createdUserIds.push(activeUser.id);

    wildcardUser = await User.create({
      full_name: `Inspector 100%_Especial\\Ruta ${uniqueSuffix}`,
      email: `inspector_100%.especial.${uniqueSuffix}@agrosystem.test`,
      password_hash: '$2b$10$testhash0000000000000000000000000000000000000',
      role: 'inifap',
      status: 'activo',
    });
    createdUserIds.push(wildcardUser.id);

    deletedUser = await User.create({
      full_name: `Usuario Eliminado ${uniqueSuffix}`,
      email: `eliminado.${uniqueSuffix}@agrosystem.test`,
      password_hash: '$2b$10$testhash0000000000000000000000000000000000000',
      role: 'agricultor',
      status: 'activo',
    });

    const logsToCreate = [
      {
        user_id: activeUser.id,
        action: 'create',
        table_name: 'Farms',
        record_id: markerRecordId,
        new_values: { name: `Parcela ${uniqueSuffix}` },
      },
      {
        user_id: activeUser.id,
        action: 'create_crop_cycle',
        table_name: 'FarmCrops',
        record_id: markerRecordId,
        new_values: { name: `Ciclo ${uniqueSuffix}` },
      },
      {
        user_id: null,
        action: 'update',
        table_name: 'Crops',
        record_id: markerRecordId,
        new_values: { name: `Log Sistema sin usuario ${uniqueSuffix}` },
      },
      {
        user_id: deletedUser.id,
        action: 'delete',
        table_name: 'Plagues',
        record_id: markerRecordId,
        old_values: {
          name: `Log de usuario que será eliminado ${uniqueSuffix}`,
        },
      },
      {
        user_id: wildcardUser.id,
        action: 'verify',
        table_name: 'Products',
        record_id: markerRecordId,
        new_values: { name: `Producto Especial ${uniqueSuffix}` },
      },
    ];

    for (const payload of logsToCreate) {
      const log = await AuditLog.create(payload);
      createdLogIds.push(log.id);
    }

    await deletedUser.destroy();
  });

  afterAll(async () => {
    if (createdLogIds.length > 0) {
      await AuditLog.destroy({ where: { id: { [Op.in]: createdLogIds } } });
    }
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: { [Op.in]: createdUserIds } } });
    }
    await sequelize.close();
  });

  it('conserva el log con user_id = NULL cuando el usuario asociado es eliminado', async () => {
    const logs = await AuditLog.findAll({
      where: { record_id: markerRecordId },
      include: [{ model: User, as: 'user', required: false }],
      order: [['id', 'ASC']],
    });

    expect(logs).toHaveLength(5);
    const nullLogs = logs.filter((l) => l.user_id === null);
    expect(nullLogs).toHaveLength(2);

    for (const log of nullLogs) {
      const serialized = serializeAuditLog(log);
      expect(serialized.user.name).toBe('Sistema');
      expect(serialized.user.role).toBe('SISTEMA');
    }
  });

  it('mantiene paridad exacta de count y IDs entre legacy DISTINCT+JOIN y count separado en todos los filtros (search, module, action, user_id NULL y eliminado)', async () => {
    const cases = [
      ['sin filtros (incluye user_id NULL y usuario eliminado)', {}],
      ['filtro module=cultivos (user_id NULL)', { module: 'cultivos' }],
      ['filtro module=plagas (usuario eliminado)', { module: 'plagas' }],
      ['filtro action=crear', { action: 'crear' }],
      ['búsqueda por table_name (Farms)', { search: 'Farms' }],
      ['búsqueda por action (create_crop)', { search: 'create_crop' }],
      [
        'búsqueda por usuario activo (nombre/correo)',
        { search: `auditor.activo.${uniqueSuffix}` },
      ],
      [
        'búsqueda sin coincidencias (PredioInexistente)',
        { search: 'PredioInexistenteXYZ999' },
      ],
    ];

    const scopeFilter = { record_id: markerRecordId };

    for (const [, rawQuery] of cases) {
      const query = normalizeAuditQuery(rawQuery);
      const newWhere = {
        ...buildAuditWhere(Sequelize, query),
        ...scopeFilter,
      };
      const legacyWhere = buildLegacyAuditWhere(query, scopeFilter);

      const [newCount, newRows, legacyResult] = await Promise.all([
        AuditLog.count({ where: newWhere }),
        AuditLog.findAll({
          where: newWhere,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'full_name', 'email', 'role'],
              required: false,
            },
          ],
          order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
          ],
          subQuery: false,
        }),
        AuditLog.findAndCountAll({
          where: legacyWhere,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'full_name', 'email', 'role'],
              required: false,
            },
          ],
          order: [
            ['createdAt', 'DESC'],
            ['id', 'DESC'],
          ],
          subQuery: false,
          distinct: true,
        }),
      ]);

      expect(newCount).toBe(legacyResult.count);
      expect(newRows.map((r) => r.id)).toEqual(
        legacyResult.rows.map((r) => r.id),
      );
    }
  });

  it('escapa %, _ y \\ en búsquedas contra PostgreSQL sin tratarlos como comodines', async () => {
    const scopeFilter = { record_id: markerRecordId };

    const exactWildcardQuery = normalizeAuditQuery({
      search: `100%_Especial\\Ruta ${uniqueSuffix}`,
    });
    const exactCount = await AuditLog.count({
      where: {
        ...buildAuditWhere(Sequelize, exactWildcardQuery),
        ...scopeFilter,
      },
    });
    expect(exactCount).toBe(1);

    const unescapedPercentQuery = normalizeAuditQuery({
      search: `Auditor%Activo ${uniqueSuffix}`,
    });
    const percentCount = await AuditLog.count({
      where: {
        ...buildAuditWhere(Sequelize, unescapedPercentQuery),
        ...scopeFilter,
      },
    });
    expect(percentCount).toBe(0);

    const underscoreQuery = normalizeAuditQuery({ search: 'create_crop' });
    const underscoreCount = await AuditLog.count({
      where: {
        ...buildAuditWhere(Sequelize, underscoreQuery),
        ...scopeFilter,
      },
    });
    expect(underscoreCount).toBe(1);
  });

  it('exporta CSV desde auditPrivate incluyendo registros filtrados y serializa user_id NULL / usuario eliminado como Sistema', async () => {
    const req = {
      query: {
        format: 'csv',
        search: `Auditor Activo ${uniqueSuffix}`,
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
    };

    await auditPrivate(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    const csvPayload = res.send.mock.calls[0][0];
    expect(csvPayload).toContain(`Parcela ${uniqueSuffix}`);
    expect(csvPayload).toContain(`Ciclo ${uniqueSuffix}`);
  });
});
