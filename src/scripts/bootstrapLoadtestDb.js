import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  assertSafeEnvironment,
  createDbPool,
  DEFAULT_OPTIONS,
  isProductionEnv,
  LOADTEST_PREFIX,
  seedLoadTestData,
} from './seedLoadTestData.js';

const parseNonNegativeEnvInt = (rawValue, fallback) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Valor entero inválido en entorno de carga: "${rawValue}"`);
  }
  return parsed;
};

export const parseBootstrapVolumes = (env = process.env) => ({
  farms: parseNonNegativeEnvInt(env.LOADTEST_FARMS, DEFAULT_OPTIONS.farms),
  cycles: parseNonNegativeEnvInt(env.LOADTEST_CYCLES, DEFAULT_OPTIONS.cycles),
  audit: parseNonNegativeEnvInt(env.LOADTEST_AUDIT, DEFAULT_OPTIONS.audit),
  notifications: parseNonNegativeEnvInt(
    env.LOADTEST_NOTIFICATIONS,
    DEFAULT_OPTIONS.notifications,
  ),
  sessions: parseNonNegativeEnvInt(
    env.LOADTEST_SESSIONS,
    DEFAULT_OPTIONS.sessions,
  ),
  batchSize: parseNonNegativeEnvInt(
    env.LOADTEST_BATCH_SIZE,
    DEFAULT_OPTIONS.batchSize,
  ),
});

export const defaultRunSequelizeCommand = (subcommand, env = process.env) => {
  execFileSync('pnpm', ['exec', 'sequelize-cli', subcommand], {
    stdio: 'inherit',
    env,
  });
};

const queryTotalCount = async (pool, sql, params = []) => {
  const res = await pool.query(sql, params);
  return Number(res.rows[0]?.total || 0);
};

const seedCatalogIfEmpty = async (pool, env, runSequelizeCommand) => {
  const cropsCount = await queryTotalCount(
    pool,
    'SELECT COUNT(*)::int AS total FROM "Crops"',
  );
  if (cropsCount > 0) return false;

  console.log('🌱 Catálogo vacío: ejecutando db:seed:all...');
  runSequelizeCommand('db:seed:all', env);
  return true;
};

const seedSyntheticVolumeIfEmpty = async (pool, env, runSeed) => {
  if (env.LOADTEST_AUTO_SEED === 'false') return null;

  const syntheticCount = await queryTotalCount(
    pool,
    'SELECT COUNT(*)::int AS total FROM "Farms" WHERE name LIKE $1',
    [`${LOADTEST_PREFIX}%`],
  );
  if (syntheticCount > 0) return null;

  const volumes = parseBootstrapVolumes(env);
  console.log('📦 Sembrando volumen sintético de carga...');
  return runSeed(pool, { ...volumes, append: true }, { env });
};

const withBootstrapPool = async (pool, env, task) => {
  const activePool = pool || createDbPool(env);
  try {
    return await task(activePool);
  } finally {
    if (!pool) {
      await activePool.end();
    }
  }
};

export const bootstrapLoadtestDb = async ({
  pool = null,
  env = process.env,
  runSequelizeCommand = defaultRunSequelizeCommand,
  runSeed = seedLoadTestData,
} = {}) => {
  if (isProductionEnv(env)) {
    throw new Error(
      'Operación bloqueada: bootstrapLoadtestDb.js no puede ejecutarse cuando NODE_ENV=production.',
    );
  }
  assertSafeEnvironment(env);

  return withBootstrapPool(pool, env, async (activePool) => {
    console.log('🛠️ Ejecutando migraciones Sequelize en BD de carga...');
    runSequelizeCommand('db:migrate', env);

    await activePool.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');

    const seededBaseCatalog = await seedCatalogIfEmpty(
      activePool,
      env,
      runSequelizeCommand,
    );
    const loadtestResult = await seedSyntheticVolumeIfEmpty(
      activePool,
      env,
      runSeed,
    );

    await activePool.query('ANALYZE');

    return {
      migrated: true,
      pgStatStatementsEnabled: true,
      seededBaseCatalog,
      seededLoadtest: Boolean(loadtestResult),
      loadtestInserted: loadtestResult?.inserted || null,
    };
  });
};

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  bootstrapLoadtestDb()
    .then((summary) => {
      console.log(
        '✅ Bootstrap de BD de carga listo:',
        JSON.stringify(summary),
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error en bootstrapLoadtestDb:', error.message);
      process.exit(1);
    });
}
