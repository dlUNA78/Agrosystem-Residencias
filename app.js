import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import hbs from "express-hbs";
import session from "express-session";
import passport from "passport";
import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";

// Importar la instancia de Sequelize
import sequelize from "./src/config/database.js";
import db from "./src/models/index.js";


import publicRoutes from "./src/routes/publicRoutes.js";
import privateRoutes from "./src/routes/privateRoutes.js";

const { User } = db;

// __dirname no existe en ES Modules — lo reconstruimos
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Handlebars
app.engine(
  "hbs",
  hbs.express4({
    extname: ".hbs",
    layoutsDir: path.join(__dirname, "src/views/layouts"),
    defaultLayout: path.join(__dirname, "src/views/layouts/public"),
    partialsDir: path.join(__dirname, "src/views/partials"),
  }),
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "src/views"));

// Registrar helpers explícitamente (express-hbs ignora la opción helpers en express4)
hbs.registerHelper("eq", (a, b) => a === b);
hbs.registerHelper("urlEncode", (str) => encodeURIComponent(str));

// Archivos estáticos y Middlewares base
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Renderizar vista principal
app.use('/', publicRoutes);
app.use('/', privateRoutes);

// --- CONFIGURACIÓN DE SESIONES Y PASSPORT ---

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secreto_de_respaldo",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

// Inicializamos Passport para que se cuelgue de la sesión
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" }, // Le decimos que usaremos 'email' en vez de 'username'
    async (email, password, done) => {
      try {
        // Buscamos al usuario
        const user = await User.findOne({ where: { email } });

        // No revelar si el error fue el correo o la contraseña
        if (!user) {
          return done(null, false, { message: "Credenciales incorrectas." });
        }

        // Si el usuario se registró con Google, no tiene contraseña. Si intenta entrar por aquí, lo bloqueamos.
        if (!user.password_hash) {
          return done(null, false, {
            message: "Esta cuenta utiliza inicio de sesión con Google.",
          });
        }

        // Verificación Criptográfica
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return done(null, false, { message: "Credenciales incorrectas." });
        }

        // Return to Passport to be stored in the Session
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

// Convierte el usuario en un simple ID para que la cookie sea ligera y segura.
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Recuperar de la Sesión
// En CADA petición del usuario (ej. cambiar de página), Passport lee el ID de la cookie,
// busca al usuario en la BD y lo inyecta en `req.user` para que lo usemos.
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Arrancar el servidor
// Probar la conexión a la base de datos y arrancar el servidor
try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos PostgreSQL establecida exitosamente.');

    app.listen(PORT, () => {
        console.log(`✅ Servidor AgroSystem encendido en: http://localhost:${PORT}`);
    });
} catch (error) {
    console.error('❌ Error al conectar con la base de datos PostgreSQL:', error);
    process.exit(1); // Detiene el proceso si no hay base de datos como se solicitó
}