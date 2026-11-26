import 'dotenv/config';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import compression from 'compression';
import hbs from 'express-hbs';
import session from 'express-session';
import passport from 'passport';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import configurePassport from './src/config/passport.js';

// Reutilizar la misma instancia de Sequelize que utilizan los modelos.
import db from './src/models/index.js';
import publicRoutes from './src/routes/publicRoutes.js';
import privateRoutes from './src/routes/privateRoutes.js';
import authRoutes from './src/routes/auth.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import {
  seedDefaultUsers,
  shouldRunDefaultUsersSeed,
} from './src/scripts/seedDefaultUsers.js';
import {
  resolveEffectivePermissions,
  getUserRoleSummary,
} from './src/services/rbacService.js';
import { enrichSessionActivity } from './src/services/sessionManagementService.js';
import { sendNotFoundResponse } from './src/utils/errorRenderer.js';

const { sequelize } = db;

// __dirname no existe en ES Modules — lo reconstruimos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── VALIDACIÓN DE ENTORNO ────────────────────────────────────────────────
// Si falta una variable crítica, el servidor NO debe arrancar.
// Un fallback "silencioso" en producción es peor que un crash explícito:
// preferimos un error claro en el log a una sesión firmada con un secreto
// público o a una caída de sesiones en producción.
const requiredEnvVars = [
  'SESSION_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASS',
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Faltan variables de entorno requeridas: ${missingEnvVars.join(', ')}`,
  );
  console.error('   Revisa tu archivo .env antes de continuar.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

export const resolveTrustProxy = (env = process.env) => {
  const raw = typeof env.TRUST_PROXY === 'string' ? env.TRUST_PROXY.trim() : '';
  if (!raw || raw === '0' || raw.toLowerCase() === 'false') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const configureTrustProxy = (appInstance, env = process.env) => {
  const trustProxyValue = resolveTrustProxy(env);
  if (trustProxyValue !== null) {
    appInstance.set('trust proxy', trustProxyValue);
  }
  return trustProxyValue;
};

configureTrustProxy(app);

// ─── RENDIMIENTO: COMPRESIÓN GZIP/BROTLI DE RESPUESTAS ─────────────────────
app.use(compression());

// ─── SEGURIDAD: ENCABEZADOS HTTP CON HELMET ──────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

// ─── POOL DE CONEXIÓN COMPARTIDO (pg) ─────────────────────────────────────
// connect-pg-simple necesita un cliente `pg` crudo, no una instancia Sequelize.
// En vez de duplicar credenciales manualmente, construimos un Pool una sola
// vez aquí, usando las mismas variables de entorno que Sequelize. Si la
// contraseña de BD cambia, sólo se edita el .env.
const parsePoolOptionInt = (raw, fallback) => {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const buildPgPoolConfig = (env = process.env) => ({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
  max: parsePoolOptionInt(
    env.DB_SESSION_POOL_MAX,
    env.NODE_ENV === 'test' ? 2 : 10,
  ),
  idleTimeoutMillis: parsePoolOptionInt(env.DB_SESSION_POOL_IDLE_MS, 10000),
  connectionTimeoutMillis: parsePoolOptionInt(
    env.DB_SESSION_POOL_ACQUIRE_MS,
    30000,
  ),
});

export const pgPool = new pg.Pool(buildPgPoolConfig());

let closeAppResourcesPromise;

export const closeAppResources = () => {
  if (!closeAppResourcesPromise) {
    closeAppResourcesPromise = Promise.all([pgPool.end(), sequelize.close()]);
  }

  return closeAppResourcesPromise;
};

// Configuración de Handlebars
app.engine(
  'hbs',
  hbs.express4({
    extname: '.hbs',
    layoutsDir: path.join(__dirname, 'src/views/layouts'),
    defaultLayout: path.join(__dirname, 'src/views/layouts/public'),
    partialsDir: path.join(__dirname, 'src/views/partials'),
    helpers: {
      eq: function (a, b) {
        return a === b;
      },
    },
  }),
);

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Registrar helpers explícitamente (express-hbs ignora la opción helpers en express4)
hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('ne', (a, b) => a !== b);
hbs.registerHelper('gt', (a, b) => Number(a) > Number(b));
hbs.registerHelper('lt', (a, b) => Number(a) < Number(b));
hbs.registerHelper('gte', (a, b) => Number(a) >= Number(b));
hbs.registerHelper('lte', (a, b) => Number(a) <= Number(b));
hbs.registerHelper('add', (a, b) => Number(a) + Number(b));
hbs.registerHelper('sub', (a, b) => Number(a) - Number(b));
hbs.registerHelper('or', (...args) => args.slice(0, -1).some(Boolean));
hbs.registerHelper('and', (...args) => args.slice(0, -1).every(Boolean));
hbs.registerHelper('urlEncode', (str) =>
  str !== null && str !== undefined ? encodeURIComponent(String(str)) : '',
);
hbs.registerHelper('formatDate', (dateVal) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (_e) {
    return String(dateVal);
  }
});
hbs.registerHelper('json', (context) => JSON.stringify(context || []));
hbs.registerHelper('getMesBg', (mesNum, siembra, cosecha, mesActual) => {
  const num = Number(mesNum);
  const cur = Number(mesActual);
  const enCosecha =
    Array.isArray(cosecha) && num >= cosecha[0] && num <= cosecha[1];
  const enSiembra =
    Array.isArray(siembra) && num >= siembra[0] && num <= siembra[1];

  if (enCosecha) return 'bg-[#1b4332]';
  if (enSiembra) return 'bg-[#73b398]';
  if (num === cur) return 'bg-emerald-100/60';
  return 'bg-secondary/50';
});

// ─── HELPERS RBAC Y CONTROL DE ACCESO EN VISTAS ────────────────────────────
hbs.registerHelper('hasRole', function (...args) {
  const lastArg = args[args.length - 1];
  const isHandlebarsOptions =
    lastArg &&
    typeof lastArg === 'object' &&
    ('hash' in lastArg || 'data' in lastArg);

  let user = null;
  let roles = null;

  if (isHandlebarsOptions) {
    const options = lastArg;
    const realArgs = args.slice(0, -1);

    if (realArgs.length === 1) {
      roles = realArgs[0];
      user = options?.data?.root?.user;
    } else if (realArgs.length >= 2) {
      const passedUser = realArgs[0];
      roles = realArgs[1];
      user =
        passedUser && typeof passedUser === 'object' && passedUser.role
          ? passedUser
          : options?.data?.root?.user;
    }
  } else {
    if (args.length >= 2) {
      user = args[0];
      roles = args[1];
    } else if (args.length === 1) {
      roles = args[0];
    }
  }

  if (!user || !user.role || !roles) return false;

  const allowedList =
    typeof roles === 'string'
      ? roles.split(',').map((r) => r.trim())
      : Array.isArray(roles)
        ? roles
        : [];

  return allowedList.includes(user.role);
});

hbs.registerHelper('canAccessPanel', function (user, options) {
  const targetUser =
    user && typeof user === 'object' && user.role
      ? user
      : (options || user)?.data?.root?.user;
  if (!targetUser || !targetUser.role) return false;
  return targetUser.role === 'inifap' || targetUser.role === 'admin';
});

hbs.registerHelper('userInitial', function (user, options) {
  const targetUser =
    user && typeof user === 'object'
      ? user
      : (options || user)?.data?.root?.user;
  if (!targetUser) return 'U';
  const name = targetUser.full_name || targetUser.email || 'U';
  return name.trim().charAt(0).toUpperCase();
});

hbs.registerHelper('hasPermission', function (perm, options) {
  const user = options?.data?.root?.user;
  if (!user) return false;
  if (user.role === 'admin') return true;
  const perms = options?.data?.root?.effectivePermissions || [];
  return perms.includes(perm);
});

// Resolución resiliente de imágenes estáticas sin I/O síncrono por petición (1.A9)
const publicDir = path.join(__dirname, 'public');
const supportedImageExtensions = ['.webp', '.jpg', '.jpeg', '.png'];
const defaultFallbackUrl = '/images/test/default.png';
const defaultFallbackPath = path.join(
  publicDir,
  'images',
  'test',
  'default.png',
);
const fallbackEligiblePrefixes = [
  '/images/cultivos/',
  '/images/crops/',
  '/images/products/',
  '/images/plagas/',
];
const MAX_IMAGE_FALLBACK_CACHE_SIZE = 500;
const imageFallbackCache = new Map();

export const clearImageFallbackCache = () => {
  imageFallbackCache.clear();
};

const fileExistsAsync = (targetPath) =>
  fsPromises.access(targetPath).then(
    () => true,
    () => false,
  );

const rememberImageFallback = (cacheKey, resolvedUrl) => {
  if (imageFallbackCache.size >= MAX_IMAGE_FALLBACK_CACHE_SIZE) {
    const oldestKey = imageFallbackCache.keys().next().value;
    imageFallbackCache.delete(oldestKey);
  }
  imageFallbackCache.set(cacheKey, resolvedUrl);
  return resolvedUrl;
};

const isEligibleForDefaultImage = (reqPath) =>
  reqPath.includes('/default.') ||
  fallbackEligiblePrefixes.some((prefix) => reqPath.startsWith(prefix));

const findAlternativeExtensionUrl = async (requestedFile, reqUrl, ext) => {
  if (!supportedImageExtensions.includes(ext)) {
    return null;
  }
  const basePath = requestedFile.slice(0, -ext.length);
  const candidateExtensions = supportedImageExtensions.filter((e) => e !== ext);
  for (const altExt of candidateExtensions) {
    if (await fileExistsAsync(`${basePath}${altExt}`)) {
      return reqUrl.slice(0, -ext.length) + altExt;
    }
  }
  return null;
};

export const resolveFallbackImageUrl = async (reqPath, reqUrl = reqPath) => {
  if (imageFallbackCache.has(reqPath)) {
    return imageFallbackCache.get(reqPath);
  }

  const requestedFile = path.resolve(publicDir, `.${reqPath}`);
  if (!requestedFile.startsWith(publicDir)) {
    return null;
  }

  const ext = path.extname(reqPath).toLowerCase();
  const altUrl = await findAlternativeExtensionUrl(requestedFile, reqUrl, ext);
  if (altUrl) {
    return rememberImageFallback(reqPath, altUrl);
  }

  if (
    isEligibleForDefaultImage(reqPath) &&
    (await fileExistsAsync(defaultFallbackPath))
  ) {
    return rememberImageFallback(reqPath, defaultFallbackUrl);
  }

  return null;
};

// Archivos estáticos primero (sirve imágenes existentes de forma asíncrona sin entrar al fallback)
const staticPublicMiddleware = express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
  etag: true,
});

app.use(staticPublicMiddleware);

app.use(async (req, res, next) => {
  if (
    (req.method !== 'GET' && req.method !== 'HEAD') ||
    !req.path.startsWith('/images/')
  ) {
    return next();
  }

  const fallbackUrl = await resolveFallbackImageUrl(req.path, req.url);
  if (!fallbackUrl) {
    return next();
  }

  req.url = fallbackUrl;
  return staticPublicMiddleware(req, res, next);
});
app.use(
  '/vendor/leaflet',
  express.static(path.join(__dirname, 'node_modules/leaflet/dist')),
);
app.use(
  '/vendor/lucide',
  express.static(path.join(__dirname, 'node_modules/lucide/dist/umd')),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURACIÓN DE SESIONES Y PASSPORT ---

const PgSession = connectPgSimple(session);

export const SESSION_COOKIE_NAME = 'agrosystem.sid';
export const SESSION_COOKIE_PATH = '/';
export const SESSION_COOKIE_SAME_SITE = 'lax';
export const SESSION_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 1 día
export const SESSION_ABSOLUTE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

export const resolveSessionCookieSecure = (env = process.env) => {
  if (env.COOKIE_SECURE === 'false') {
    return false;
  }
  if (env.COOKIE_SECURE === 'true') {
    return true;
  }
  return env.NODE_ENV === 'production';
};

export const buildSessionClearCookieOptions = (env = process.env) => ({
  path: SESSION_COOKIE_PATH,
  httpOnly: true,
  sameSite: SESSION_COOKIE_SAME_SITE,
  secure: resolveSessionCookieSecure(env),
});

export const buildSessionCookieOptions = (env = process.env) => ({
  ...buildSessionClearCookieOptions(env),
  maxAge: SESSION_COOKIE_MAX_AGE_MS,
});

const parseSessionCreatedAtMs = (rawValue) => {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }
  if (typeof rawValue === 'string' && rawValue.trim()) {
    const parsed = Date.parse(rawValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.NaN;
};

export const isSessionAbsolutelyExpired = (
  sessionData,
  { now = Date.now(), absoluteMaxAgeMs = SESSION_ABSOLUTE_MAX_AGE_MS } = {},
) => {
  if (!sessionData || typeof sessionData !== 'object') {
    return false;
  }
  const createdAtMs = parseSessionCreatedAtMs(sessionData.sessionCreatedAt);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }
  return now - createdAtMs >= absoluteMaxAgeMs;
};

const stripClearedSessionCookieHeader = (res, cookieName) => {
  const existing = res.getHeader?.('Set-Cookie');
  if (!existing) {
    return;
  }
  const list = Array.isArray(existing) ? existing : [existing];
  const clearedPrefix = `${cookieName}=;`;
  const remaining = list.filter(
    (entry) => !String(entry).startsWith(clearedPrefix),
  );
  if (remaining.length > 0) {
    res.setHeader('Set-Cookie', remaining);
  } else {
    res.removeHeader('Set-Cookie');
  }
};

const stampLoginSessionCreatedAt = (req, res, options, callback) => {
  const { nowProvider, inheritedCreatedAt, cookieName, stripClearedCookie } =
    options;
  if (!req.session) {
    return callback(null);
  }
  if (stripClearedCookie) {
    stripClearedSessionCookieHeader(res, cookieName);
  }
  if (!Number.isFinite(parseSessionCreatedAtMs(req.session.sessionCreatedAt))) {
    req.session.sessionCreatedAt = Number.isFinite(inheritedCreatedAt)
      ? inheritedCreatedAt
      : nowProvider();
    if (typeof req.session.save === 'function') {
      return req.session.save((saveErr) => callback(saveErr));
    }
  }
  return callback(null);
};

const wrapLoginForSessionCreation = (req, res, options) => {
  if (typeof req.logIn !== 'function') {
    return;
  }
  const originalLogIn = req.logIn.bind(req);
  const wrappedLogIn = (user, loginOptions, done) => {
    const hasOptions = typeof loginOptions !== 'function';
    const resolvedOptions = hasOptions ? loginOptions : {};
    const callback = hasOptions ? done : loginOptions;

    if (!req.session && typeof req.sessionStore?.generate === 'function') {
      req.sessionStore.generate(req);
    }

    return originalLogIn(user, resolvedOptions, (loginErr) => {
      if (loginErr) {
        return callback(loginErr);
      }
      return stampLoginSessionCreatedAt(req, res, options, callback);
    });
  };
  req.logIn = wrappedLogIn;
  req.login = wrappedLogIn;
};

const isLogoutPath = (reqPath) => {
  const normalized = String(reqPath || '').replace(/\/+$/, '') || '/';
  return normalized === '/auth/logout';
};

export const createAbsoluteSessionExpirationMiddleware =
  ({
    absoluteMaxAgeMs = SESSION_ABSOLUTE_MAX_AGE_MS,
    nowProvider = () => Date.now(),
    cookieName = SESSION_COOKIE_NAME,
    clearCookieOptions = buildSessionClearCookieOptions(),
  } = {}) =>
  (req, res, next) => {
    const effectiveCookieName =
      req.app?.get?.('sessionCookieName') || cookieName;
    const effectiveClearOptions =
      req.app?.get?.('sessionClearCookieOptions') || clearCookieOptions;

    if (!req.user || !req.session) {
      wrapLoginForSessionCreation(req, res, {
        nowProvider,
        inheritedCreatedAt: Number.NaN,
        cookieName: effectiveCookieName,
        stripClearedCookie: false,
      });
      return next();
    }

    const now = nowProvider();
    const createdAtMs = parseSessionCreatedAtMs(req.session.sessionCreatedAt);

    if (!Number.isFinite(createdAtMs)) {
      req.session.sessionCreatedAt = now;
      wrapLoginForSessionCreation(req, res, {
        nowProvider,
        inheritedCreatedAt: now,
        cookieName: effectiveCookieName,
        stripClearedCookie: false,
      });
      return next();
    }

    if (now - createdAtMs < absoluteMaxAgeMs) {
      wrapLoginForSessionCreation(req, res, {
        nowProvider,
        inheritedCreatedAt: createdAtMs,
        cookieName: effectiveCookieName,
        stripClearedCookie: false,
      });
      return next();
    }

    const finalizeExpiredSession = () => {
      res.clearCookie(effectiveCookieName, effectiveClearOptions);
      if (isLogoutPath(req.path)) {
        return res.redirect('/auth/login');
      }
      wrapLoginForSessionCreation(req, res, {
        nowProvider,
        inheritedCreatedAt: Number.NaN,
        cookieName: effectiveCookieName,
        stripClearedCookie: true,
      });
      return next();
    };

    req.user = null;
    if (typeof req.session.destroy === 'function') {
      return req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error(
            'Error al destruir sesión tras expiración absoluta:',
            destroyErr,
          );
        }
        return finalizeExpiredSession();
      });
    }

    return finalizeExpiredSession();
  };

const sessionClearCookieOptions = buildSessionClearCookieOptions();
app.set('sessionCookieName', SESSION_COOKIE_NAME);
app.set('sessionClearCookieOptions', sessionClearCookieOptions);

const logLoadTestModeWarnings = (env = process.env) => {
  if (env.DISABLE_RATE_LIMIT === 'true') {
    if (env.NODE_ENV === 'production' && env.LOADTEST_MODE !== 'true') {
      console.warn(
        '⚠️ [SEGURIDAD] DISABLE_RATE_LIMIT=true ignorado en NODE_ENV=production porque LOADTEST_MODE no es "true".',
      );
    } else {
      console.warn(
        '⚠️ MODO CARGA CONTROLADA: DISABLE_RATE_LIMIT=true desactiva rate limiting en memoria.',
      );
    }
  }
  if (env.NODE_ENV === 'production' && env.COOKIE_SECURE === 'false') {
    console.warn(
      '⚠️ MODO CARGA CONTROLADA: COOKIE_SECURE=false permite cookies de sesión sobre HTTP sin TLS.',
    );
  }
};

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    // Reutilizamos el pool de pg en vez de pasar credenciales sueltas.
    // Esto garantiza que Sequelize y las sesiones usen la misma configuración.
    store: new PgSession({
      pool: pgPool,
      // El esquema de sesiones se administra mediante migración para evitar
      // carreras cuando varias instancias arrancan al mismo tiempo.
      createTableIfMissing: false,
      // 1.A6: desactiva UPDATE "session" SET expire=... en cada petición GET no modificada.
      // Tanto `expire` en BD como `lastActive` y la cookie se renuevan juntos cada 5 min
      // cuando `enrichSessionActivity` actualiza la sesión (o al cambiar IP / User-Agent).
      disableTouch: true,
    }),
    // Ya no hay fallback hardcoded: si SESSION_SECRET falta, el proceso
    // ya se detuvo arriba en la validación de entorno.
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: buildSessionCookieOptions(),
  }),
);

// Inicializamos Passport para que se cuelgue de la sesión
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());
app.use(createAbsoluteSessionExpirationMiddleware());
app.use((req, res, next) => {
  // Convierte la instancia del modelo a objeto plano y sanitiza campos sensibles
  if (req.user) {
    enrichSessionActivity(req);
    const safeUser =
      typeof req.user.toJSON === 'function'
        ? req.user.toJSON()
        : { ...req.user };
    delete safeUser.password_hash;
    delete safeUser.password;
    res.locals.user = safeUser;
    const effectiveSet = resolveEffectivePermissions(req.user);
    res.locals.effectivePermissions = Array.from(effectiveSet);
    res.locals.userRoleSummary = getUserRoleSummary(req.user);
  } else {
    res.locals.user = null;
    res.locals.effectivePermissions = [];
    res.locals.userRoleSummary = null;
  }

  const _render = res.render.bind(res);
  res.render = function (view, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    const merged = { ...res.locals, ...(options || {}) };
    return _render(view, merged, callback);
  };

  next();
});

app.get('/login', (_req, res) => res.redirect(302, '/auth/login'));
app.get('/register', (_req, res) => res.redirect(302, '/auth/register'));

app.use('/auth', authRoutes);
app.use('/', publicRoutes);
app.use('/', notificationRoutes);
app.use('/', privateRoutes);

// Manejador 404 para rutas inexistentes
app.use((req, res) => sendNotFoundResponse(req, res));

// Arrancar el servidor solo si no estamos en entorno de prueba
if (process.env.NODE_ENV !== 'test') {
  try {
    await sequelize.authenticate();
    console.log(
      '✅ Conexión a la base de datos PostgreSQL establecida exitosamente.',
    );

    // Crear usuarios por defecto solo en entornos no productivos y únicamente si no existen
    if (shouldRunDefaultUsersSeed(process.env)) {
      await seedDefaultUsers();
    }
    logLoadTestModeWarnings();

    app.listen(PORT, () => {
      console.log(
        `✅ Servidor AgroSystem encendido en: http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    console.error(
      '❌ Error al conectar con la base de datos PostgreSQL:',
      error,
    );
    process.exit(1);
  }
}

export default app;
