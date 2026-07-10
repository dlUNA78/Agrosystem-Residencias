import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import hbs from "express-hbs";
import session from "express-session";
import passport from "passport";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import configurePassport from "./src/config/passport.js";

// Importar la instancia de Sequelize
import sequelize from "./src/config/database.js";
import db from "./src/models/index.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import privateRoutes from "./src/routes/privateRoutes.js";
import authRoutes from "./src/routes/auth.js";
import { seedDefaultUsers } from "./src/scripts/seedDefaultUsers.js";

const { User } = db;

// __dirname no existe en ES Modules — lo reconstruimos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── VALIDACIÓN DE ENTORNO ────────────────────────────────────────────────
// Si falta una variable crítica, el servidor NO debe arrancar.
// Un fallback "silencioso" en producción es peor que un crash explícito:
// preferimos un error claro en el log a una sesión firmada con un secreto
// público o a una caída de sesiones en producción.
const requiredEnvVars = [
  "SESSION_SECRET",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASS",
];

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Faltan variables de entorno requeridas: ${missingEnvVars.join(", ")}`,
  );
  console.error("   Revisa tu archivo .env antes de continuar.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── POOL DE CONEXIÓN COMPARTIDO (pg) ─────────────────────────────────────
// connect-pg-simple necesita un cliente `pg` crudo, no una instancia Sequelize.
// En vez de duplicar credenciales manualmente, construimos un Pool una sola
// vez aquí, usando las mismas variables de entorno que ya usa Sequelize en
// src/config/database.js. Si la contraseña de BD cambia, sólo se edita el .env.
const pgPool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
});

// Configuración de Handlebars
app.engine(
  "hbs",
  hbs.express4({
    extname: ".hbs",
    layoutsDir: path.join(__dirname, "src/views/layouts"),
    defaultLayout: path.join(__dirname, "src/views/layouts/public"),
    partialsDir: path.join(__dirname, "src/views/partials"),
    helpers: {
      eq: function (a, b) {
        return a === b;
      },
    },
  }),
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "src/views"));

// Registrar helpers explícitamente (express-hbs ignora la opción helpers en express4)
hbs.registerHelper("eq", (a, b) => a === b);
hbs.registerHelper("urlEncode", (str) => encodeURIComponent(str));
hbs.registerHelper("add", (a, b) => a + b);

// Archivos estáticos y Middlewares base
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURACIÓN DE SESIONES Y PASSPORT ---

const PgSession = connectPgSimple(session);

app.use(
  session({
    // Reutilizamos el pool de pg en vez de pasar credenciales sueltas.
    // Esto elimina la duplicación con src/config/database.js y garantiza
    // que ambas conexiones (Sequelize y sesiones) siempre usan la misma fuente.
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
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 1 día
    },
  }),
);

// Inicializamos Passport para que se cuelgue de la sesión
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  // Convierte la instancia del modelo a objeto plano
  res.locals.user = req.user ? req.user.toJSON() : null;

  const _render = res.render.bind(res);
  res.render = function (view, options, callback) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    const merged = { ...res.locals, ...(options || {}) };
    return _render(view, merged, callback);
  };

  next();
});

app.use("/auth", authRoutes);
app.use("/", publicRoutes);
app.use("/", privateRoutes);

// Arrancar el servidor
// Probar la conexión a la base de datos y arrancar el servidor
try {
  await sequelize.authenticate();
  console.log(
    "✅ Conexión a la base de datos PostgreSQL establecida exitosamente.",
  );

  // Crear usuarios por defecto si no existen (admin/inifap y agricultor)
  await seedDefaultUsers();

  app.listen(PORT, () => {
    console.log(
      `✅ Servidor AgroSystem encendido en: http://localhost:${PORT}`,
    );
  });
} catch (error) {
  console.error("❌ Error al conectar con la base de datos PostgreSQL:", error);
  process.exit(1); // Detiene el proceso si no hay base de datos como se solicitó
}
