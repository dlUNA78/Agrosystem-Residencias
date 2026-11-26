#!/usr/bin/env node
/**
 * Respaldo rápido (< 1 min) de la base de datos de demostración (agrosystem_demo).
 *
 * Guardrails obligatorios:
 *   - Bloqueado si NODE_ENV === 'production'.
 *   - Bloqueado si DB_NAME no inicia con "agrosystem_demo".
 *
 * Uso:
 *   node scripts/demo/backupDemoDb.js
 *   node scripts/demo/backupDemoDb.js --env-file .env.demo --out scripts/demo/backups/pre-demo.dump
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import {
  assertDemoEnvironment,
  buildPgToolEnv,
  DEFAULT_BACKUP_DIR,
  loadDemoEnv,
  parseDemoCliArgs,
  resolvePgTool,
} from './demoGuardrails.js';

const formatTimestamp = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '_',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

const resolveBackupOutputPath = (explicitOut, dbName) => {
  if (explicitOut) {
    return path.resolve(explicitOut);
  }
  return path.join(DEFAULT_BACKUP_DIR, `${dbName}_${formatTimestamp()}.dump`);
};

export const backupDemoDb = async ({
  envFile = null,
  out = null,
  env = process.env,
} = {}) => {
  loadDemoEnv(envFile);
  const dbConfig = assertDemoEnvironment(env);
  const pgDumpBin = resolvePgTool('pg_dump');

  const outPath = resolveBackupOutputPath(out, dbConfig.database);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const startedAt = performance.now();
  execFileSync(
    pgDumpBin,
    [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--host',
      dbConfig.host,
      '--port',
      String(dbConfig.port),
      '--username',
      dbConfig.user,
      '--file',
      outPath,
      dbConfig.database,
    ],
    {
      env: buildPgToolEnv(dbConfig),
      stdio: 'inherit',
    },
  );
  const elapsedSeconds = Number(
    ((performance.now() - startedAt) / 1000).toFixed(2),
  );

  const stats = fs.statSync(outPath);
  if (!stats.size) {
    throw new Error(`El archivo de respaldo quedó vacío: ${outPath}`);
  }

  const sizeKb = Number((stats.size / 1024).toFixed(1));
  console.log(
    `✅ Respaldo demo generado en ${elapsedSeconds}s (${sizeKb} KB): ${outPath}`,
  );

  return {
    database: dbConfig.database,
    filePath: outPath,
    sizeBytes: stats.size,
    elapsedSeconds,
  };
};

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const args = parseDemoCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Uso: node scripts/demo/backupDemoDb.js [--env-file .env.demo] [--out ruta/archivo.dump]',
    );
    process.exit(0);
  }
  backupDemoDb({ envFile: args.envFile, out: args.out })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error en backupDemoDb:', error.message);
      process.exit(1);
    });
}
