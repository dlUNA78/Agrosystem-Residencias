export const REQUIRED_ENV_VARS = Object.freeze([
  'SESSION_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASS',
]);

const isBlankValue = (val) =>
  val === undefined || val === null || String(val).trim() === '';

export const getMissingEnvVars = (
  env = process.env,
  requiredVars = REQUIRED_ENV_VARS,
) => requiredVars.filter((key) => isBlankValue(env[key]));

export const validateEnv = (env = process.env, options = {}) => {
  const requiredVars = options.requiredVars || REQUIRED_ENV_VARS;
  const logger = options.logger || console;
  const missingEnvVars = getMissingEnvVars(env, requiredVars);

  if (missingEnvVars.length > 0) {
    const message = `❌ Faltan variables de entorno requeridas: ${missingEnvVars.join(', ')}`;
    logger.error(message);
    logger.error('   Revisa tu archivo .env antes de continuar.');

    if (options.exitOnError) {
      process.exit(1);
    }

    const error = new Error(message);
    error.missingEnvVars = missingEnvVars;
    throw error;
  }

  return { valid: true, missingEnvVars: [] };
};
