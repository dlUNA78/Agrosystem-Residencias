import 'dotenv/config';

const parsePositiveInt = (raw, fallback) => {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (raw, fallback) => {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

export const resolveSequelizeLogging = (env = process.env) =>
  env.DB_LOGGING === 'true' ? console.log : false;

export const resolveSequelizePool = (env = process.env) => {
  const isTest = env.NODE_ENV === 'test';
  return {
    max: parsePositiveInt(env.DB_POOL_MAX, isTest ? 5 : 20),
    min: parseNonNegativeInt(env.DB_POOL_MIN, isTest ? 0 : 2),
    acquire: parsePositiveInt(env.DB_POOL_ACQUIRE_MS, 30000),
    idle: parsePositiveInt(env.DB_POOL_IDLE_MS, 10000),
  };
};

export const buildSequelizeEnvConfig = (env = process.env) => ({
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: env.DB_DIALECT || 'postgres',
  logging: resolveSequelizeLogging(env),
  pool: resolveSequelizePool(env),
});

export default {
  development: buildSequelizeEnvConfig({
    ...process.env,
    NODE_ENV: 'development',
  }),
  test: buildSequelizeEnvConfig({
    ...process.env,
    NODE_ENV: 'test',
  }),
  production: buildSequelizeEnvConfig({
    ...process.env,
    NODE_ENV: 'production',
  }),
};
