#!/usr/bin/env node
/**
 * Restauración rápida (< 1 min) de la base de datos de demostración (agrosystem_demo).
 *
 * Guardrails obligatorios:
 *   - Bloqueado si NODE_ENV === 'production'.
 *   - Bloqueado si DB_NAME no inicia con "agrosystem_demo".
 *
 * Uso:
 *   node scripts/demo/restoreDemoDb.js --latest
 *   node scripts/demo/restoreDemoDb.js --file scripts/demo/backups/agrosystem_demo_20261126.dump
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import {
  assertDemoDatabaseName,
  assertDemoEnvironment,
  assertNotProductionEnvironment,
  buildPgToolEnv,
  createDemoPool,
  createMaintenanceClient,
  DEFAULT_BACKUP_DIR,
  ensureDemoDatabaseExists,
  loadDemoEnv,
  parseDemoCliArgs,
  resolvePgTool,
} from './demoGuardrails.js';

const findLatestDumpFile = () => {
  if (!fs.existsSync(DEFAULT_BACKUP_DIR)) {
    throw new Error(
      `No existe el directorio de respaldos: ${DEFAULT_BACKUP_DIR}`,
    );
  }

  const candidates = fs
    .readdirSync(DEFAULT_BACKUP_DIR)
    .filter((name) => name.endsWith('.dump'))
    .map((name) => {
      const fullPath = path.join(DEFAULT_BACKUP_DIR, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(
      `No se encontraron archivos .dump en ${DEFAULT_BACKUP_DIR}. Ejecuta primero backupDemoDb.js.`,
    );
  }

  return candidates[0].fullPath;
};

const resolveDumpFilePath = ({ file, latest }) => {
  if (file) {
    const resolved = path.resolve(file);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Archivo de respaldo no encontrado: ${resolved}`);
    }
    return resolved;
  }
  if (latest) {
    return findLatestDumpFile();
  }
  throw new Error(
    'Debes indicar --file <ruta.dump> o --latest para restaurar un respaldo demo.',
  );
};

const terminateActiveConnections = async (dbConfig, env) => {
  const dbName = assertDemoDatabaseName(dbConfig.database);
  const client = createMaintenanceClient(dbConfig, env);
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [dbName],
    );
  } finally {
    await client.end();
  }
};

const resetDemoPublicSchema = async (dbConfig) => {
  assertDemoDatabaseName(dbConfig.database);
  const pool = createDemoPool(dbConfig);
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
  } finally {
    await pool.end();
  }
};

const verifyRestoredSummary = async (dbConfig) => {
  const pool = createDemoPool(dbConfig);
  try {
    const [users, crops, plagues, products, farms, codes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM "Users"'),
      pool.query('SELECT COUNT(*)::int AS total FROM "Crops"'),
      pool.query('SELECT COUNT(*)::int AS total FROM "Plagues"'),
      pool.query('SELECT COUNT(*)::int AS total FROM "Products"'),
      pool.query('SELECT COUNT(*)::int AS total FROM "Farms"'),
      pool.query(
        'SELECT COUNT(*)::int AS total FROM "InifapCodes" WHERE is_used = false AND revoked_at IS NULL',
      ),
    ]);
    return {
      users: users.rows[0].total,
      crops: crops.rows[0].total,
      plagues: plagues.rows[0].total,
      products: products.rows[0].total,
      farms: farms.rows[0].total,
      availableInifapCodes: codes.rows[0].total,
    };
  } finally {
    await pool.end();
  }
};

export const restoreDemoDb = async ({
  envFile = null,
  file = null,
  latest = false,
  env = process.env,
} = {}) => {
  assertNotProductionEnvironment(process.env);
  assertNotProductionEnvironment(env);
  loadDemoEnv(envFile, env);
  const dbConfig = assertDemoEnvironment(env);
  const dumpPath = resolveDumpFilePath({ file, latest });
  const pgRestoreBin = resolvePgTool('pg_restore');

  const startedAt = performance.now();
  await ensureDemoDatabaseExists(dbConfig, env);
  await terminateActiveConnections(dbConfig, env);
  await resetDemoPublicSchema(dbConfig);

  execFileSync(
    pgRestoreBin,
    [
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--host',
      dbConfig.host,
      '--port',
      String(dbConfig.port),
      '--username',
      dbConfig.user,
      '--dbname',
      dbConfig.database,
      dumpPath,
    ],
    {
      env: buildPgToolEnv(dbConfig),
      stdio: 'inherit',
    },
  );

  const summary = await verifyRestoredSummary(dbConfig);
  const elapsedSeconds = Number(
    ((performance.now() - startedAt) / 1000).toFixed(2),
  );

  console.log(
    `✅ Restauración demo completada en ${elapsedSeconds}s desde ${dumpPath}`,
  );
  console.log(
    `   Verificación: Users=${summary.users}, Crops=${summary.crops}, Plagues=${summary.plagues}, Products=${summary.products}, Farms=${summary.farms}, InifapCodesDisponibles=${summary.availableInifapCodes}`,
  );

  return {
    database: dbConfig.database,
    filePath: dumpPath,
    elapsedSeconds,
    summary,
  };
};

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const args = parseDemoCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Uso: node scripts/demo/restoreDemoDb.js [--env-file .env.demo] (--latest | --file ruta/archivo.dump)',
    );
    process.exit(0);
  }
  restoreDemoDb({
    envFile: args.envFile,
    file: args.file,
    latest: args.latest,
  })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error en restoreDemoDb:', error.message);
      process.exit(1);
    });
}
