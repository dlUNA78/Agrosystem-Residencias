#!/usr/bin/env node
/**
 * Script de carga de volumen sintético para pruebas de rendimiento (Fase 0.A2).
 *
 * Bloqueado explícitamente si NODE_ENV=production.
 * Uso:
 *   node src/scripts/seedLoadTestData.js
 *   node src/scripts/seedLoadTestData.js --farms 50000 --cycles 50000 --audit 500000 --notifications 50000 --sessions 100000
 *   node src/scripts/seedLoadTestData.js --reset
 *   node src/scripts/seedLoadTestData.js --append --farms 1000
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const LOADTEST_PREFIX = '[LOADTEST]';
export const LOADTEST_SESSION_PREFIX = 'loadtest:';

export const DEFAULT_OPTIONS = Object.freeze({
  farms: 50000,
  cycles: 50000,
  audit: 500000,
  notifications: 50000,
  sessions: 100000,
  batchSize: 10000,
  reset: false,
  seed: false,
  append: false,
  help: false,
});

const NUMERIC_FLAG_MAP = Object.freeze({
  '--farms': 'farms',
  '--cycles': 'cycles',
  '--audit': 'audit',
  '--notifications': 'notifications',
  '--sessions': 'sessions',
  '--batch-size': 'batchSize',
});

const BOOLEAN_FLAG_MAP = Object.freeze({
  '--help': 'help',
  '-h': 'help',
  '--reset': 'reset',
  '--seed': 'seed',
  '--append': 'append',
});

const REQUIRED_DB_VARS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASS',
];

export const isProductionEnv = (env = process.env) =>
  String(env?.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production';

export const assertSafeEnvironment = (env = process.env) => {
  if (isProductionEnv(env)) {
    throw new Error(
      'Operación bloqueada: seedLoadTestData.js no puede ejecutarse cuando NODE_ENV=production.',
    );
  }

  const missing = REQUIRED_DB_VARS.filter((key) => !env?.[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno de base de datos: ${missing.join(', ')}.`,
    );
  }
};

const parseCountValue = (
  rawValue,
  flagName,
  { min = 0, max = 5000000 } = {},
) => {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Valor inválido para ${flagName} ("${rawValue}"). Debe ser un entero entre ${min} y ${max}.`,
    );
  }
  return parsed;
};

const splitArgToken = (token) => {
  const eqIndex = token.indexOf('=');
  if (eqIndex === -1) {
    return { flag: token, inlineValue: null };
  }
  return {
    flag: token.slice(0, eqIndex),
    inlineValue: token.slice(eqIndex + 1),
  };
};

const readFlagValue = (argv, index, inlineValue, flag) => {
  if (inlineValue !== null) {
    return { rawValue: inlineValue, consumedNext: false };
  }
  const nextVal = argv[index + 1];
  if (nextVal === undefined) {
    throw new Error(`Falta valor numérico después de ${flag}.`);
  }
  return { rawValue: nextVal, consumedNext: true };
};

export const parseCliArgs = (argv = []) => {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const { flag, inlineValue } = splitArgToken(String(argv[i]));
    const boolKey = BOOLEAN_FLAG_MAP[flag];

    if (boolKey) {
      options[boolKey] = true;
      continue;
    }

    const optionKey = NUMERIC_FLAG_MAP[flag];
    if (!optionKey) {
      throw new Error(
        `Argumento no reconocido: ${flag}. Usa --help para ver opciones.`,
      );
    }

    const { rawValue, consumedNext } = readFlagValue(
      argv,
      i,
      inlineValue,
      flag,
    );
    const bounds =
      optionKey === 'batchSize' ? { min: 1, max: 50000 } : { min: 0 };
    options[optionKey] = parseCountValue(rawValue, flag, bounds);
    if (consumedNext) {
      i += 1;
    }
  }

  return options;
};

export const buildHelpText = () =>
  `Uso: node src/scripts/seedLoadTestData.js [opciones]

Genera datos sintéticos repetibles para pruebas de rendimiento (bloqueado si NODE_ENV=production).

Opciones:
  --farms N          Terrenos sintéticos a generar (default: ${DEFAULT_OPTIONS.farms})
  --cycles N         Ciclos de cultivo sintéticos a generar (default: ${DEFAULT_OPTIONS.cycles})
  --audit N          Registros de auditoría sintéticos (default: ${DEFAULT_OPTIONS.audit})
  --notifications N  Notificaciones sintéticas (default: ${DEFAULT_OPTIONS.notifications})
  --sessions N       Sesiones sintéticas en "session" (default: ${DEFAULT_OPTIONS.sessions})
  --batch-size N     Tamaño de lote SQL por consulta (default: ${DEFAULT_OPTIONS.batchSize})
  --reset            Elimina únicamente los datos sintéticos previos y termina
  --seed             Combinado con --reset: limpia primero y luego genera el lote
  --append           Conserva los datos sintéticos existentes en lugar de reiniciar antes de sembrar
  --help, -h         Muestra esta ayuda`;

export const createDbPool = (env = process.env) => {
  assertSafeEnvironment(env);
  return new pg.Pool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASS,
  });
};

const countRows = (res) => res.rowCount || 0;

export const resetSyntheticData = async (client, { vacuum = false } = {}) => {
  const farmPattern = `${LOADTEST_PREFIX}%`;
  const sessionPattern = `${LOADTEST_SESSION_PREFIX}%`;

  const deletedCycles = await client.query(
    `DELETE FROM "FarmCrops"
     WHERE area_section LIKE $1
        OR farm_id IN (SELECT id FROM "Farms" WHERE name LIKE $1)`,
    [farmPattern],
  );

  if (vacuum && countRows(deletedCycles) > 0) {
    await client.query('VACUUM "FarmCrops"').catch(() => {});
  }

  const deletedFarms = await client.query(
    'DELETE FROM "Farms" WHERE name LIKE $1',
    [farmPattern],
  );

  const deletedAudit = await client.query(
    `DELETE FROM "AuditLogs" WHERE new_values @> '{"loadtest":true}'::jsonb`,
  );

  const deletedNotifications = await client.query(
    'DELETE FROM "Notifications" WHERE title LIKE $1',
    [farmPattern],
  );

  const deletedSessions = await client.query(
    'DELETE FROM "session" WHERE sid LIKE $1',
    [sessionPattern],
  );

  if (vacuum) {
    const deletedTables = [
      ['FarmCrops', deletedCycles],
      ['Farms', deletedFarms],
      ['AuditLogs', deletedAudit],
      ['Notifications', deletedNotifications],
      ['session', deletedSessions],
    ];
    for (const [tableName, result] of deletedTables) {
      if (countRows(result) > 0) {
        await client
          .query(`VACUUM FULL ANALYZE "${tableName}"`)
          .catch(() => {});
      }
    }
  }

  return {
    farmCrops: countRows(deletedCycles),
    farms: countRows(deletedFarms),
    auditLogs: countRows(deletedAudit),
    notifications: countRows(deletedNotifications),
    sessions: countRows(deletedSessions),
  };
};

export const fetchReferenceIds = async (client) => {
  const usersRes = await client.query('SELECT id FROM "Users" ORDER BY id ASC');
  const regionsRes = await client.query(
    'SELECT id FROM "Regions" ORDER BY id ASC',
  );
  const cropsRes = await client.query('SELECT id FROM "Crops" ORDER BY id ASC');

  const userIds = usersRes.rows.map((r) => r.id);
  const regionIds = regionsRes.rows.map((r) => r.id);
  const cropIds = cropsRes.rows.map((r) => r.id);

  if (userIds.length === 0) {
    throw new Error(
      'No hay usuarios en la base de datos para asignar llaves foráneas (user_id).',
    );
  }

  return { userIds, regionIds, cropIds };
};

const runBatches = async (total, batchSize, executor) => {
  if (total <= 0) return 0;

  let inserted = 0;
  for (let start = 1; start <= total; start += batchSize) {
    const end = Math.min(total, start + batchSize - 1);
    await executor(start, end);
    inserted += end - start + 1;
  }
  return inserted;
};

const insertFarms = async (client, count, batchSize, refs, runTag) => {
  if (count <= 0) return [];

  const insertedIds = [];
  const regionArray = refs.regionIds.length > 0 ? refs.regionIds : null;

  await runBatches(count, batchSize, async (start, end) => {
    const res = await client.query(
      `INSERT INTO "Farms" (
         name, location_lat, location_lng, size_hectares,
         farming_type, municipality, status, user_id, region_id,
         "createdAt", "updatedAt"
       )
       SELECT
         $1 || ' Predio ' || $6 || '-' || gs,
         ROUND((19.0 + ((gs % 500) / 1000.0))::numeric, 7),
         ROUND((-102.5 + ((gs % 500) / 1000.0))::numeric, 7),
         ROUND((5 + (gs % 120))::numeric, 2),
         (ARRAY['Riego', 'Temporal', 'Mixto'])[1 + (gs % 3)],
         (ARRAY['Uruapan', 'Culiacán', 'Morelia', 'Los Mochis', 'Zamora'])[1 + (gs % 5)],
         (gs % 20) <> 0,
         ($4::int[])[1 + ((gs - 1) % array_length($4::int[], 1))],
         CASE
           WHEN $5::int[] IS NULL THEN NULL
           ELSE ($5::int[])[1 + ((gs - 1) % array_length($5::int[], 1))]
         END,
         NOW() - ((gs % 365) * interval '1 day'),
         NOW() - ((gs % 30) * interval '1 day')
       FROM generate_series($2::int, $3::int) AS gs
       RETURNING id`,
      [LOADTEST_PREFIX, start, end, refs.userIds, regionArray, runTag],
    );

    for (const row of res.rows) {
      insertedIds.push(row.id);
    }
  });

  return insertedIds;
};

const resolveCandidateFarmIds = async (client, createdFarmIds) => {
  if (createdFarmIds.length > 0) return createdFarmIds;
  const existing = await client.query(
    'SELECT id FROM "Farms" WHERE status = true ORDER BY id ASC LIMIT 50000',
  );
  return existing.rows.map((r) => r.id);
};

const insertCycles = async (
  client,
  count,
  batchSize,
  refs,
  farmIds,
  runTag,
) => {
  if (count <= 0) return 0;

  if (refs.cropIds.length === 0) {
    throw new Error(
      'No hay cultivos en "Crops" para asociar ciclos sintéticos en "FarmCrops".',
    );
  }
  const candidateFarms = await resolveCandidateFarmIds(client, farmIds);
  if (candidateFarms.length === 0) {
    throw new Error(
      'No hay terrenos disponibles para asociar ciclos sintéticos en "FarmCrops".',
    );
  }

  return runBatches(count, batchSize, async (start, end) => {
    await client.query(
      `INSERT INTO "FarmCrops" (
         farm_id, crop_id, area_section, planting_date,
         is_active, status, "createdAt", "updatedAt"
       )
       SELECT
         ($4::int[])[1 + ((gs - 1) % array_length($4::int[], 1))],
         ($5::int[])[1 + ((gs - 1) % array_length($5::int[], 1))],
         $1 || ' Lote-' || $6 || '-' || gs,
         NOW() - ((gs % 240) * interval '1 day'),
         (gs % 5) <> 0,
         (ARRAY['En Crecimiento', 'En Floración', 'En Cosecha', 'Finalizado'])[1 + (gs % 4)],
         NOW() - ((gs % 240) * interval '1 day'),
         NOW() - ((gs % 15) * interval '1 day')
       FROM generate_series($2::int, $3::int) AS gs`,
      [LOADTEST_PREFIX, start, end, candidateFarms, refs.cropIds, runTag],
    );
  });
};

const insertAuditLogs = async (
  client,
  count,
  batchSize,
  refs,
  farmIds,
  runTag,
) => {
  const refIds = farmIds.length > 0 ? farmIds.slice(0, 5000) : null;

  return runBatches(count, batchSize, async (start, end) => {
    await client.query(
      `INSERT INTO "AuditLogs" (
         action, table_name, record_id, old_values, new_values,
         user_id, "createdAt", "updatedAt"
       )
       SELECT
         (ARRAY['create', 'update', 'create_crop_cycle', 'advance_crop_stage', 'verify'])[1 + (gs % 5)],
         (ARRAY['Farms', 'FarmCrops', 'Crops', 'Plagues', 'Products'])[1 + (gs % 5)],
         CASE
           WHEN $5::int[] IS NULL THEN gs
           ELSE ($5::int[])[1 + ((gs - 1) % array_length($5::int[], 1))]
         END,
         jsonb_build_object('loadtest', true, 'phase', 'before', 'seq', gs),
         jsonb_build_object('loadtest', true, 'batch', $4::text, 'seq', gs),
         ($3::int[])[1 + ((gs - 1) % array_length($3::int[], 1))],
         NOW() - ((gs % 90) * interval '1 day') - ((gs % 86400) * interval '1 second'),
         NOW() - ((gs % 90) * interval '1 day')
       FROM generate_series($1::int, $2::int) AS gs`,
      [start, end, refs.userIds, runTag, refIds],
    );
  });
};

const insertNotifications = async (client, count, batchSize, refs, runTag) =>
  runBatches(count, batchSize, async (start, end) => {
    await client.query(
      `INSERT INTO "Notifications" (
         user_id, actor_id, category, severity, title, message,
         action_url, is_read, read_at, "createdAt", "updatedAt"
       )
       SELECT
         ($4::int[])[1 + ((gs - 1) % array_length($4::int[], 1))],
         ($4::int[])[1 + (gs % array_length($4::int[], 1))],
         (ARRAY['sistema', 'editorial', 'monitoreo'])[1 + (gs % 3)],
         (ARRAY['info', 'success', 'warning'])[1 + (gs % 3)],
         $1 || ' Notificación #' || $5 || '-' || gs,
         'Evento sintético generado para línea base de rendimiento #' || gs,
         '/private/lands',
         (gs % 3) = 0,
         CASE WHEN (gs % 3) = 0 THEN NOW() - interval '1 hour' ELSE NULL END,
         NOW() - ((gs % 60) * interval '1 day'),
         NOW() - ((gs % 60) * interval '1 day')
       FROM generate_series($2::int, $3::int) AS gs`,
      [LOADTEST_PREFIX, start, end, refs.userIds, runTag],
    );
  });

const insertSessions = async (client, count, batchSize, refs, runTag) =>
  runBatches(count, batchSize, async (start, end) => {
    await client.query(
      `INSERT INTO "session" (sid, sess, expire)
       SELECT
         $1 || $5::text || ':' || gs,
         json_build_object(
           'cookie', json_build_object(
             'originalMaxAge', 86400000,
             'expires', to_char(NOW() + interval '1 day', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'httpOnly', true,
             'path', '/'
           ),
           'passport', json_build_object(
             'user', ($4::int[])[1 + ((gs - 1) % array_length($4::int[], 1))]
           ),
           'clientIp', ('10.' || ((gs / 65536) % 255) || '.' || ((gs / 256) % 255) || '.' || ((gs % 254) + 1)),
           'userAgent', (ARRAY[
             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
             'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
             'Mozilla/5.0 (Android 14; Mobile) Firefox/122.0',
             'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Edge/121.0'
           ])[1 + (gs % 4)],
           'lastActive', to_char(NOW() - ((gs % 72) * interval '1 hour'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'loadtest', true
         ),
         CASE
           WHEN (gs % 5) = 0 THEN NOW() - interval '2 days'
           ELSE NOW() + ((1 + (gs % 24)) * interval '1 hour')
         END
       FROM generate_series($2::int, $3::int) AS gs`,
      [LOADTEST_SESSION_PREFIX, start, end, refs.userIds, runTag],
    );
  });

const withTransaction = async (pool, manageTransaction, fn) => {
  const client = await pool.connect();
  try {
    if (manageTransaction) {
      await client.query('BEGIN');
    }
    const result = await fn(client);
    if (manageTransaction) {
      await client.query('COMMIT');
    }
    return result;
  } catch (error) {
    if (manageTransaction) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
};

const runAutocommitReset = async (pool) => {
  const client = await pool.connect();
  try {
    return await resetSyntheticData(client, { vacuum: true });
  } finally {
    client.release();
  }
};

const executeResetOnly = async (pool, manageTransaction, startedAt) => {
  const deleted = manageTransaction
    ? await runAutocommitReset(pool)
    : await withTransaction(pool, false, (client) =>
        resetSyntheticData(client, { vacuum: false }),
      );

  return {
    mode: 'reset',
    elapsedMs: Date.now() - startedAt,
    deleted,
    inserted: {
      farms: 0,
      cycles: 0,
      audit: 0,
      notifications: 0,
      sessions: 0,
    },
  };
};

export const seedLoadTestData = async (
  pool,
  rawOptions = {},
  { env = process.env, manageTransaction = true } = {},
) => {
  if (isProductionEnv(env)) {
    throw new Error(
      'Operación bloqueada: seedLoadTestData.js no puede ejecutarse cuando NODE_ENV=production.',
    );
  }

  const options = { ...DEFAULT_OPTIONS, ...rawOptions };
  const startedAt = Date.now();
  const runTag = randomUUID().slice(0, 8);

  if (options.reset && !options.seed) {
    return executeResetOnly(pool, manageTransaction, startedAt);
  }

  const preDeleted =
    !options.append && manageTransaction
      ? await runAutocommitReset(pool)
      : null;

  return withTransaction(pool, manageTransaction, async (client) => {
    const deleted = options.append
      ? null
      : (preDeleted ?? (await resetSyntheticData(client, { vacuum: false })));
    const refs = await fetchReferenceIds(client);

    const farmIds = await insertFarms(
      client,
      options.farms,
      options.batchSize,
      refs,
      runTag,
    );
    const cycles = await insertCycles(
      client,
      options.cycles,
      options.batchSize,
      refs,
      farmIds,
      runTag,
    );
    const audit = await insertAuditLogs(
      client,
      options.audit,
      options.batchSize,
      refs,
      farmIds,
      runTag,
    );
    const notifications = await insertNotifications(
      client,
      options.notifications,
      options.batchSize,
      refs,
      runTag,
    );
    const sessions = await insertSessions(
      client,
      options.sessions,
      options.batchSize,
      refs,
      runTag,
    );

    return {
      mode: options.append ? 'append' : 'seed',
      elapsedMs: Date.now() - startedAt,
      deleted,
      inserted: {
        farms: farmIds.length,
        cycles,
        audit,
        notifications,
        sessions,
      },
    };
  });
};

export const runCli = async (
  argv = process.argv.slice(2),
  env = process.env,
) => {
  await import('dotenv/config');
  const options = parseCliArgs(argv);

  if (options.help) {
    console.log(buildHelpText());
    return 0;
  }

  const pool = createDbPool(env);
  try {
    const result = await seedLoadTestData(pool, options, { env });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } finally {
    await pool.end();
  }
};

const isMainExecution = () => {
  if (!process.argv[1]) return false;
  return (
    path.resolve(fileURLToPath(import.meta.url)) ===
    path.resolve(process.argv[1])
  );
};

if (isMainExecution()) {
  runCli()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Error en seedLoadTestData: ${error.message}`);
      process.exit(1);
    });
}
