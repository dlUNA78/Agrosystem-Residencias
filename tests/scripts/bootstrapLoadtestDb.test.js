import { jest } from '@jest/globals';
import {
  bootstrapLoadtestDb,
  parseBootstrapVolumes,
} from '../../src/scripts/bootstrapLoadtestDb.js';

const validEnv = {
  NODE_ENV: 'development',
  DB_HOST: 'postgres',
  DB_PORT: '5432',
  DB_NAME: 'agrosystem_loadtest',
  DB_USER: 'postgres',
  DB_PASS: 'secret',
};

const createFakePool = ({ cropsCount = 0, syntheticFarmsCount = 0 } = {}) => {
  const queries = [];
  return {
    queries,
    query: jest.fn(async (sql, params) => {
      const normalized = String(sql);
      queries.push({ sql: normalized, params });
      if (normalized.includes('FROM "Crops"')) {
        return { rows: [{ total: cropsCount }] };
      }
      if (normalized.includes('FROM "Farms"')) {
        return { rows: [{ total: syntheticFarmsCount }] };
      }
      return { rows: [] };
    }),
    end: jest.fn(async () => {}),
  };
};

describe('bootstrapLoadtestDb', () => {
  it('blocks execution when NODE_ENV=production', async () => {
    const pool = createFakePool();
    await expect(
      bootstrapLoadtestDb({
        pool,
        env: { ...validEnv, NODE_ENV: 'production' },
      }),
    ).rejects.toThrow(/NODE_ENV=production/);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('parses bootstrap volumes with safe defaults and env overrides', () => {
    expect(parseBootstrapVolumes({})).toEqual({
      farms: 50000,
      cycles: 50000,
      audit: 500000,
      notifications: 50000,
      sessions: 100000,
      batchSize: 10000,
    });

    expect(
      parseBootstrapVolumes({
        LOADTEST_FARMS: '100',
        LOADTEST_AUDIT: '0',
        LOADTEST_SESSIONS: '250',
      }),
    ).toMatchObject({
      farms: 100,
      audit: 0,
      sessions: 250,
    });

    expect(() => parseBootstrapVolumes({ LOADTEST_FARMS: '-1' })).toThrow(
      /Valor entero inválido/,
    );
  });

  it('migrates, enables pg_stat_statements, seeds base & volume on empty DB', async () => {
    const pool = createFakePool({ cropsCount: 0, syntheticFarmsCount: 0 });
    const runSequelizeCommand = jest.fn();
    const runSeed = jest.fn(async () => ({
      inserted: {
        farms: 10,
        cycles: 5,
        audit: 20,
        notifications: 5,
        sessions: 10,
      },
    }));

    const result = await bootstrapLoadtestDb({
      pool,
      env: {
        ...validEnv,
        LOADTEST_FARMS: '10',
        LOADTEST_CYCLES: '5',
        LOADTEST_AUDIT: '20',
        LOADTEST_NOTIFICATIONS: '5',
        LOADTEST_SESSIONS: '10',
      },
      runSequelizeCommand,
      runSeed,
    });

    expect(runSequelizeCommand).toHaveBeenNthCalledWith(
      1,
      'db:migrate',
      expect.objectContaining({ DB_NAME: 'agrosystem_loadtest' }),
    );
    expect(runSequelizeCommand).toHaveBeenNthCalledWith(
      2,
      'db:seed:all',
      expect.any(Object),
    );
    expect(pool.queries[0].sql).toContain(
      'CREATE EXTENSION IF NOT EXISTS pg_stat_statements',
    );
    expect(runSeed).toHaveBeenCalledTimes(1);
    expect(pool.queries.some((q) => q.sql === 'ANALYZE')).toBe(true);
    expect(result).toEqual({
      migrated: true,
      pgStatStatementsEnabled: true,
      seededBaseCatalog: true,
      seededLoadtest: true,
      loadtestInserted: {
        farms: 10,
        cycles: 5,
        audit: 20,
        notifications: 5,
        sessions: 10,
      },
    });
  });

  it('skips base seeders and synthetic seed when data already exists', async () => {
    const pool = createFakePool({ cropsCount: 7, syntheticFarmsCount: 50000 });
    const runSequelizeCommand = jest.fn();
    const runSeed = jest.fn();

    const result = await bootstrapLoadtestDb({
      pool,
      env: validEnv,
      runSequelizeCommand,
      runSeed,
    });

    expect(runSequelizeCommand).toHaveBeenCalledTimes(1);
    expect(runSequelizeCommand).toHaveBeenCalledWith(
      'db:migrate',
      expect.any(Object),
    );
    expect(runSeed).not.toHaveBeenCalled();
    expect(result).toEqual({
      migrated: true,
      pgStatStatementsEnabled: true,
      seededBaseCatalog: false,
      seededLoadtest: false,
      loadtestInserted: null,
    });
  });
});
