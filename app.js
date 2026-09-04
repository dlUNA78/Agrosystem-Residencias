import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
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
import { seedDefaultUsers } from './src/scripts/seedDefaultUsers.js';

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

// ─── SEGURIDAD: ENCABEZADOS HTTP CON HELMET ──────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── POOL DE CONEXIÓN COMPARTIDO (pg) ─────────────────────────────────────
// connect-pg-simple necesita un cliente `pg` crudo, no una instancia Sequelize.
// En vez de duplicar credenciales manualmente, construimos un Pool una sola
// vez aquí, usando las mismas variables de entorno que Sequelize. Si la
// contraseña de BD cambia, sólo se edita el .env.
const pgPool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

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
hbs.registerHelper('urlEncode', (str) => encodeURIComponent(str));
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

// Archivos estáticos y Middlewares base
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURACIÓN DE SESIONES Y PASSPORT ---

const PgSession = connectPgSimple(session);

app.use(
  session({
    // Reutilizamos el pool de pg en vez de pasar credenciales sueltas.
    // Esto garantiza que Sequelize y las sesiones usen la misma configuración.
    store: new PgSession({
      pool: pgPool,
      // 🛡️ Magia de dev: Esto crea la tabla "session" automáticamente en PostgreSQL si no existe
      createTableIfMissing: true,
    }),
    // Ya no hay fallback hardcoded: si SESSION_SECRET falta, el proceso
    // ya se detuvo arriba en la validación de entorno.
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24, // 1 día
    },
  }),
);

// Inicializamos Passport para que se cuelgue de la sesión
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  // Convierte la instancia del modelo a objeto plano y sanitiza campos sensibles
  if (req.user) {
    const safeUser =
      typeof req.user.toJSON === 'function'
        ? req.user.toJSON()
        : { ...req.user };
    delete safeUser.password_hash;
    delete safeUser.password;
    res.locals.user = safeUser;
  } else {
    res.locals.user = null;
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

app.use('/auth', authRoutes);
app.use('/', publicRoutes);
app.use('/', privateRoutes);

// Arrancar el servidor solo si no estamos en entorno de prueba
if (process.env.NODE_ENV !== 'test') {
  try {
    await sequelize.authenticate();
    console.log(
      '✅ Conexión a la base de datos PostgreSQL establecida exitosamente.',
    );

    // Crear usuarios por defecto si no existen (admin/inifap y agricultor)
    await seedDefaultUsers();

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
