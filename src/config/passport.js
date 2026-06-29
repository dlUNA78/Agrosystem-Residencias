import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";
import db from "../models/index.js";

const { User } = db;

export default function configurePassport(passport) {
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
}
