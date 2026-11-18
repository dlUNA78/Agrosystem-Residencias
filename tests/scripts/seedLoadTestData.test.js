import 'dotenv/config';
import { jest } from '@jest/globals';
import pg from 'pg';
import {
  assertSafeEnvironment,
  buildHelpText,
  DEFAULT_LOADTEST_DB_NAME,
  DEFAULT_OPTIONS,
  formatMissingLoadDatabaseError,
  isAllowedLoadTestDbName,
  isProductionEnv,
  isTestDatabaseName,
  LOADTEST_PREFIX,
  LOADTEST_SESSION_PREFIX,
  parseCliArgs,
  resetSyntheticData,
  resolveLoadTestDbName,
  seedLoadTestData,
} from '../../src/scripts/seedLoadTestData.js';

const validDbEnv = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: DEFAULT_LOADTEST_DB_NAME,
  DB_USER: 'postgres',
  DB_PASS: 'secret',
};

const createMockPool = ({
  users = [{ id: 1 }],
  regions = [{ id: 10 }],
  crops = [{ id: 20 }],
  failOnSql = null,
} = {}) => {
  const queries = [];
  const client = {
    query: jest.fn(async (sql, params) => {
      queries.push({ sql: String(sql), params });
      if (failOnSql && String(sql).includes(failOnSql)) {
        throw new Error('Injected SQL failure');
      }
      if (String(sql).includes('FROM "Users"')) return { rows: users };
      if (String(sql).includes('FROM "Regions"')) return { rows: regions };
      if (String(sql).includes('FROM "Crops"')) return { rows: crops };
      if (String(sql).includes('RETURNING id')) {
        const start = params[1];
        const end = params[2];
        const rows = [];
        for (let id = start; id <= end; id += 1) {
          rows.push({ id: 1000 + id });
        }
        return { rows, rowCount: rows.length };
      }
      if (String(sql).startsWith('DELETE FROM')) {
        return { rowCount: 3, rows: [] };
      }
      return { rows: [], rowCount: 0 };
    }),
    release: jest.fn(),
  };

  return {
    connect: jest.fn(async () => client),
    client,
    queries,
  };
};

describe('seedLoadTestData CLI & guard', () => {
  it('detects and blocks NODE_ENV=production before connecting to DB', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: 'PRODUCTION' })).toBe(true);
    expect(isProductionEnv({ NODE_ENV: 'development' })).toBe(false);

    expect(() =>
      assertSafeEnvironment({ ...validDbEnv, NODE_ENV: 'production' }),
    ).toThrow(/NODE_ENV=production/);

    expect(() =>
      assertSafeEnvironment({ NODE_ENV: 'test', DB_HOST: 'localhost' }),
    ).toThrow(/DB_PORT/);

    expect(() =>
      assertSafeEnvironment({
        ...validDbEnv,
        LOADTEST_DB_NAME: 'agrosystem_test',
      }),
    ).toThrow(/agrosystem_test/);

    expect(() =>
      assertSafeEnvironment({
        ...validDbEnv,
        LOADTEST_DB_NAME: 'agrosystem_db',
      }),
    ).toThrow(/agrosystem_db/);

    expect(() =>
      assertSafeEnvironment({
        ...validDbEnv,
        DB_NAME: 'sistema_plagas',
      }),
    ).toThrow(/sistema_plagas/);

    expect(isTestDatabaseName('agrosystem_test')).toBe(true);
    expect(isTestDatabaseName('AGROSYSTEM_TEST')).toBe(true);
    expect(isTestDatabaseName('agrosystem_load')).toBe(false);

    expect(isAllowedLoadTestDbName('agrosystem_load', {})).toBe(true);
    expect(isAllowedLoadTestDbName('agrosystem_loadtest', {})).toBe(true);
    expect(isAllowedLoadTestDbName('sistema_plagas', {})).toBe(false);
    expect(
      isAllowedLoadTestDbName('custom_bench_db', {
        LOADTEST_DB_NAME: 'custom_bench_db',
      }),
    ).toBe(true);
    expect(
      isAllowedLoadTestDbName('agrosystem_test', {
        LOADTEST_DB_NAME: 'agrosystem_test',
      }),
    ).toBe(false);

    const logger = { warn: jest.fn() };
    expect(
      resolveLoadTestDbName(
        { DB_NAME: 'agrosystem_db' },
        { logRedirect: true, logger },
      ),
    ).toBe('agrosystem_load');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Redirigiendo base de datos de "agrosystem_db" a "agrosystem_load"',
      ),
    );

    expect(resolveLoadTestDbName({ DB_NAME: 'agrosystem_test' })).toBe(
      'agrosystem_load',
    );
    expect(resolveLoadTestDbName({ DB_NAME: 'agrosystem_loadtest' })).toBe(
      'agrosystem_loadtest',
    );
    expect(
      resolveLoadTestDbName({
        DB_NAME: 'agrosystem_test',
        LOADTEST_DB_NAME: 'agrosystem_load',
      }),
    ).toBe('agrosystem_load');

    const missingDbErr = Object.assign(
      new Error('database "agrosystem_load" does not exist'),
      { code: '3D000' },
    );
    const formattedErr = formatMissingLoadDatabaseError(
      missingDbErr,
      'agrosystem_load',
    );
    expect(formattedErr.message).toContain('loadtests/README.md');
    expect(formattedErr.message).toContain('CREATE DATABASE agrosystem_load');
    expect(formattedErr.message).toContain('sequelize-cli db:migrate');

    expect(() => assertSafeEnvironment(validDbEnv)).not.toThrow();
    expect(() =>
      assertSafeEnvironment({
        ...validDbEnv,
        DB_NAME: 'agrosystem_test',
        LOADTEST_DB_NAME: 'agrosystem_load',
      }),
    ).not.toThrow();
    expect(() =>
      assertSafeEnvironment({
        ...validDbEnv,
        DB_NAME: 'agrosystem_test',
        LOADTEST_DB_NAME: 'custom_bench_db',
      }),
    ).not.toThrow();
  });

  it('parses default volumes and custom CLI overrides cleanly', () => {
    expect(parseCliArgs([])).toEqual(DEFAULT_OPTIONS);

    expect(
      parseCliArgs([
        '--farms',
        '100',
        '--cycles=50',
        '--audit',
        '0',
        '--notifications=20',
        '--sessions',
        '15',
        '--batch-size=250',
        '--append',
      ]),
    ).toEqual({
      farms: 100,
      cycles: 50,
      audit: 0,
      notifications: 20,
      sessions: 15,
      batchSize: 250,
      reset: false,
      seed: false,
      append: true,
      help: false,
    });

    expect(parseCliArgs(['--reset', '--seed'])).toMatchObject({
      reset: true,
      seed: true,
    });
    expect(parseCliArgs(['-h'])).toMatchObject({ help: true });
  });

  it('rejects malformed or unknown CLI flags', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow(/no reconocido/i);
    expect(() => parseCliArgs(['--farms'])).toThrow(/Falta valor/);
    expect(() => parseCliArgs(['--farms', '-5'])).toThrow(/Valor inválido/);
    expect(() => parseCliArgs(['--batch-size', '0'])).toThrow(/Valor inválido/);
  });

  it('exposes clear usage documentation in buildHelpText', () => {
    const help = buildHelpText();
    expect(help).toContain('--reset');
    expect(help).toContain('--farms');
    expect(help).toContain('--audit');
    expect(help).toContain('--sessions');
    expect(help).toContain('NODE_ENV=production');
  });
});

describe('resetSyntheticData & seedLoadTestData orchestration', () => {
  it('deletes only synthetic loadtest records in FK-safe order', async () => {
    const mock = createMockPool();
    const deleted = await resetSyntheticData(mock.client);

    expect(deleted).toEqual({
      farmCrops: 3,
      farms: 3,
      auditLogs: 3,
      notifications: 3,
      sessions: 3,
    });

    const sqlStatements = mock.queries.map((q) => q.sql);
    const cyclesIdx = sqlStatements.findIndex((s) =>
      s.includes('DELETE FROM "FarmCrops"'),
    );
    const farmsIdx = sqlStatements.findIndex((s) =>
      s.includes('DELETE FROM "Farms"'),
    );
    expect(cyclesIdx).toBeGreaterThanOrEqual(0);
    expect(farmsIdx).toBeGreaterThan(cyclesIdx);

    expect(mock.queries[cyclesIdx].params).toEqual([`${LOADTEST_PREFIX}%`]);
    expect(mock.queries[farmsIdx].params).toEqual([`${LOADTEST_PREFIX}%`]);
    expect(
      sqlStatements.some((s) => s.includes('DELETE FROM "AuditLogs"')),
    ).toBe(true);
    expect(
      sqlStatements.some((s) =>
        s.includes('DELETE FROM "Notifications" WHERE title LIKE'),
      ),
    ).toBe(true);
    const sessionsIdx = sqlStatements.findIndex((s) =>
      s.includes('DELETE FROM "session"'),
    );
    expect(mock.queries[sessionsIdx].params).toEqual([
      `${LOADTEST_SESSION_PREFIX}%`,
    ]);
  });

  it('refuses execution in production or on agrosystem_test before acquiring a DB client', async () => {
    const mock = createMockPool();
    await expect(
      seedLoadTestData(mock, { farms: 1 }, { env: { NODE_ENV: 'production' } }),
    ).rejects.toThrow(/NODE_ENV=production/);
    await expect(
      seedLoadTestData(
        mock,
        { farms: 1 },
        { env: { ...validDbEnv, LOADTEST_DB_NAME: 'agrosystem_test' } },
      ),
    ).rejects.toThrow(/agrosystem_test/);
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it('supports --reset mode without inserting new records', async () => {
    const mock = createMockPool();
    const res = await seedLoadTestData(
      mock,
      { reset: true },
      { env: validDbEnv },
    );

    expect(res.mode).toBe('reset');
    expect(res.inserted).toEqual({
      farms: 0,
      cycles: 0,
      audit: 0,
      notifications: 0,
      sessions: 0,
    });
    expect(res.deleted.farms).toBe(3);
    expect(mock.queries.some((q) => q.sql === 'VACUUM "FarmCrops"')).toBe(true);
    expect(
      mock.queries.some((q) => q.sql === 'VACUUM FULL ANALYZE "AuditLogs"'),
    ).toBe(true);
    expect(mock.queries.some((q) => q.sql.includes('INSERT INTO'))).toBe(false);
    expect(mock.client.release).toHaveBeenCalledTimes(1);
  });

  it('seeds batched synthetic rows repeatably and supports append mode', async () => {
    const mock = createMockPool();
    const seedRes = await seedLoadTestData(
      mock,
      {
        farms: 5,
        cycles: 4,
        audit: 7,
        notifications: 3,
        sessions: 6,
        batchSize: 3,
      },
      { env: validDbEnv },
    );

    expect(seedRes.mode).toBe('seed');
    expect(seedRes.deleted).not.toBeNull();
    expect(seedRes.inserted).toEqual({
      farms: 5,
      cycles: 4,
      audit: 7,
      notifications: 3,
      sessions: 6,
    });

    const appendMock = createMockPool();
    const appendRes = await seedLoadTestData(
      appendMock,
      {
        farms: 2,
        cycles: 0,
        audit: 0,
        notifications: 0,
        sessions: 2,
        append: true,
      },
      { env: validDbEnv },
    );

    expect(appendRes.mode).toBe('append');
    expect(appendRes.deleted).toBeNull();
    expect(appendMock.queries.some((q) => q.sql.includes('DELETE FROM'))).toBe(
      false,
    );
  });

  it('rolls back cleanly if any SQL error or missing references occur', async () => {
    const emptyUsers = createMockPool({ users: [] });
    await expect(
      seedLoadTestData(
        emptyUsers,
        { farms: 1, cycles: 0, audit: 0, notifications: 0, sessions: 0 },
        { env: validDbEnv },
      ),
    ).rejects.toThrow(/No hay usuarios/);
    expect(emptyUsers.queries.some((q) => q.sql === 'ROLLBACK')).toBe(true);

    const emptyCrops = createMockPool({ crops: [] });
    await expect(
      seedLoadTestData(
        emptyCrops,
        { farms: 1, cycles: 1, audit: 0, notifications: 0, sessions: 0 },
        { env: validDbEnv },
      ),
    ).rejects.toThrow(/No hay cultivos/);
    expect(emptyCrops.queries.some((q) => q.sql === 'ROLLBACK')).toBe(true);
  });
});

const shouldRunDbIntegration = /test/i.test(process.env.DB_NAME || '');

(shouldRunDbIntegration ? describe : describe.skip)(
  'seedLoadTestData PostgreSQL FK integration (rolled back)',
  () => {
    it('inserts valid synthetic rows across all 5 tables in a rolled-back transaction', async () => {
      const pool = new pg.Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
      });

      const realClient = await pool.connect();
      try {
        await realClient.query('BEGIN');
        const txPool = {
          connect: async () => ({
            query: (...args) => realClient.query(...args),
            release: () => {},
          }),
        };

        const result = await seedLoadTestData(
          txPool,
          {
            farms: 2,
            cycles: 3,
            audit: 4,
            notifications: 3,
            sessions: 4,
            batchSize: 2,
            append: true,
          },
          {
            env: {
              ...process.env,
              LOADTEST_DB_NAME:
                process.env.LOADTEST_DB_NAME || DEFAULT_LOADTEST_DB_NAME,
            },
            manageTransaction: false,
          },
        );

        expect(result.inserted).toEqual({
          farms: 2,
          cycles: 3,
          audit: 4,
          notifications: 3,
          sessions: 4,
        });
      } finally {
        await realClient.query('ROLLBACK');
        realClient.release();
        await pool.end();
      }
    });
  },
);
