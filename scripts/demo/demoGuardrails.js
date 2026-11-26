import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
export const DEFAULT_BACKUP_DIR = path.join(
  PROJECT_ROOT,
  'scripts',
  'demo',
  'backups',
);
export const SEQUELIZE_CLI_BIN = path.join(
  PROJECT_ROOT,
  'node_modules',
  'sequelize-cli',
  'lib',
  'sequelize',
);

const DEMO_DB_PREFIX_REGEX = /^agrosystem_demo/i;
const SAFE_DEMO_DB_IDENT_REGEX = /^agrosystem_demo[a-z0-9_]*$/i;
const REQUIRED_DB_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
];

const splitArgToken = (token) => {
  const eqIndex = token.indexOf('=');
  if (eqIndex === -1) {
    return { key: token, inlineValue: null };
  }
  return {
    key: token.slice(0, eqIndex),
    inlineValue: token.slice(eqIndex + 1),
  };
};

const readFlagValue = (argv, index, inlineValue, flag) => {
  if (inlineValue !== null) {
    return { value: inlineValue, consumedNext: false };
  }
  const next = argv[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`Falta valor después del parámetro ${flag}.`);
  }
  return { value: next, consumedNext: true };
};

const VALUE_FLAG_TARGETS = Object.freeze({
  '--env-file': 'envFile',
  '--file': 'file',
  '--out': 'out',
});

const applyCliToken = (parsed, argv, index) => {
  const token = String(argv[index]);
  const { key, inlineValue } = splitArgToken(token);

  if (key === '--help' || key === '-h') {
    parsed.help = true;
    return 0;
  }
  if (key === '--latest') {
    parsed.latest = true;
    return 0;
  }
  const targetKey = VALUE_FLAG_TARGETS[key];
  if (targetKey) {
    const { value, consumedNext } = readFlagValue(
      argv,
      index,
      inlineValue,
      key,
    );
    parsed[targetKey] = value;
    return consumedNext ? 1 : 0;
  }
  if (!token.startsWith('-') && !parsed.file) {
    parsed.file = token;
    return 0;
  }
  throw new Error(`Parámetro no reconocido: "${token}". Usa --help.`);
};

export const parseDemoCliArgs = (argv = []) => {
  const parsed = {
    envFile: null,
    file: null,
    out: null,
    latest: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    i += applyCliToken(parsed, argv, i);
  }

  return parsed;
};

export const resolveEnvFilePath = (explicitPath = null) => {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Archivo de entorno no encontrado: ${resolved}`);
    }
    return { path: resolved, override: true };
  }

  const demoEnvPath = path.join(PROJECT_ROOT, '.env.demo');
  if (fs.existsSync(demoEnvPath)) {
    return { path: demoEnvPath, override: false };
  }

  const defaultEnvPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(defaultEnvPath)) {
    return { path: defaultEnvPath, override: false };
  }

  return null;
};

export const isProductionEnvironment = (env = process.env) =>
  String(env?.NODE_ENV || '')
    .trim()
    .toLowerCase() === 'production';

export const assertNotProductionEnvironment = (env = process.env) => {
  if (isProductionEnvironment(env)) {
    throw new Error(
      'Operación bloqueada: los scripts de demo NO pueden ejecutarse con NODE_ENV=production.',
    );
  }
};

export const loadDemoEnv = (explicitPath = null, env = process.env) => {
  assertNotProductionEnvironment(process.env);
  assertNotProductionEnvironment(env);

  const target = resolveEnvFilePath(explicitPath);
  if (!target) return null;

  const result = dotenv.config({
    path: target.path,
    override: target.override,
    quiet: true,
  });

  if (result.error) {
    throw new Error(
      `No se pudo cargar el archivo de entorno "${target.path}": ${result.error.message}`,
    );
  }

  assertNotProductionEnvironment(process.env);
  assertNotProductionEnvironment(env);
  return target.path;
};

export const assertDemoDatabaseName = (dbName) => {
  const normalized = String(dbName || '').trim();
  if (!normalized || !DEMO_DB_PREFIX_REGEX.test(normalized)) {
    throw new Error(
      `Operación bloqueada: DB_NAME="${normalized || '(vacío)'}" no inicia con "agrosystem_demo". Configura DB_NAME=agrosystem_demo en .env.demo o en tu sesión.`,
    );
  }
  if (!SAFE_DEMO_DB_IDENT_REGEX.test(normalized)) {
    throw new Error(
      `Operación bloqueada: DB_NAME="${normalized}" contiene caracteres inválidos. Usa solo letras, números y guion bajo iniciando con "agrosystem_demo".`,
    );
  }
  return normalized;
};

export const assertDemoEnvironment = (env = process.env) => {
  assertNotProductionEnvironment(process.env);
  assertNotProductionEnvironment(env);

  const database = assertDemoDatabaseName(env?.DB_NAME);
  const missing = REQUIRED_DB_KEYS.filter(
    (key) => !String(env?.[key] ?? '').trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas para demo: ${missing.join(', ')}.`,
    );
  }

  const port = Number(env.DB_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`DB_PORT inválido: "${env.DB_PORT}".`);
  }

  return {
    host: String(env.DB_HOST).trim(),
    port,
    database,
    user: String(env.DB_USER).trim(),
    password: String(env.DB_PASS),
  };
};

export const createMaintenanceClient = (dbConfig, env = process.env) =>
  new pg.Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: String(env?.PG_MAINTENANCE_DB || 'postgres').trim(),
    user: dbConfig.user,
    password: dbConfig.password,
  });

export const createDemoPool = (dbConfig) => {
  assertDemoDatabaseName(dbConfig.database);
  return new pg.Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
  });
};

export const buildPgToolEnv = (dbConfig) => ({
  ...process.env,
  PGPASSWORD: dbConfig.password,
});

const tryWhichCommand = (toolName) => {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which';
  try {
    const stdout = execFileSync(finder, [toolName], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const firstLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return firstLine || null;
  } catch {
    return null;
  }
};

const findWindowsPgBinCandidate = (exeName) => {
  const directRoots = ['D:\\PostgreSql\\bin', 'C:\\PostgreSql\\bin'];
  for (const dir of directRoots) {
    const candidate = path.join(dir, exeName);
    if (fs.existsSync(candidate)) return candidate;
  }

  const pgBase = 'C:\\Program Files\\PostgreSQL';
  if (!fs.existsSync(pgBase)) return null;

  const versions = fs.readdirSync(pgBase).sort((a, b) => Number(b) - Number(a));
  for (const version of versions) {
    const candidate = path.join(pgBase, version, 'bin', exeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

export const resolvePgTool = (toolName) => {
  const fromPath = tryWhichCommand(toolName);
  if (fromPath) return fromPath;

  if (process.platform === 'win32') {
    const exeName = toolName.endsWith('.exe') ? toolName : `${toolName}.exe`;
    const candidate = findWindowsPgBinCandidate(exeName);
    if (candidate) return candidate;
  }

  throw new Error(
    `No se encontró la herramienta "${toolName}" en PATH. Agrega el directorio bin de PostgreSQL a PATH.`,
  );
};

export const ensureDemoDatabaseExists = async (dbConfig, env = process.env) => {
  const dbName = assertDemoDatabaseName(dbConfig.database);
  const client = createMaintenanceClient(dbConfig, env);
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (existing.rowCount > 0) {
      return false;
    }
    await client.query(`CREATE DATABASE "${dbName}"`);
    return true;
  } finally {
    await client.end();
  }
};
