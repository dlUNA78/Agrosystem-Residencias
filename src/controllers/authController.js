import bcrypt from "bcrypt";
import db from "../models/index.js";

const { User, InifapCode, sequelize } = db;

export const authController = {
  // ─── VISTAS ────────────────────────────────────────────────────────────────

  showRegister: (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect("/");
    }
    res.render("auth/register", { title: "Registrarse en INIFAP" });
  },

  showLogin: (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect("/");
    }
    res.render("auth/login", { title: "Iniciar Sesión" });
  },

  // ─── LÓGICA DE NEGOCIO ─────────────────────────────────────────────────────

  register: async (req, res) => {
    try {
      const { full_name, email, password } = req.body;

      if (!full_name || !email || !password) {
        return res.status(400).render("auth/register", {
          error: "Todos los campos son obligatorios.",
        });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).render("auth/register", {
          error: "Este correo electrónico ya está registrado.",
        });
      }

      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      await User.create({
        full_name,
        email,
        password_hash,
        role: "agricultor",
      });

      res.redirect("/auth/login");
    } catch (error) {
      console.error("CRITICAL ERROR en authController.register:", error);
      res.status(500).render("auth/register", {
        error: "Error interno del servidor. Por favor contacte al administrador.",
      });
    }
  },

  // ─── DESTRUCCIÓN DE SESIÓN ─────────────────────────────────────────────────

  logout: (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);

      // Destruimos explícitamente la sesión para que el gafete pierda validez
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/auth/login");
      });
    });
  },

  // ─── FLUJO DE ASCENSO: AGRICULTOR → INIFAP (UPGRADE) ──────────────────────

  showUpgrade: (req, res) => {
    // Si ya es INIFAP o Admin, no tiene nada que hacer aquí
    if (req.user.role === "inifap" || req.user.role === "admin") {
      return res.redirect("/dashboard");
    }
    res.render("auth/upgrade", {
      title: "Ascenso a Personal INIFAP",
      error: null,
    });
  },

  processUpgrade: async (req, res) => {
    // Helper para renderizar errores sin duplicar código
    const renderError = (message) =>
      res.status(401).render("auth/upgrade", {
        title: "Ascenso a Personal INIFAP",
        // 🛡️ Mensaje genérico: no revela si el código existe,
        // está usado o expirado → evita enumeración de códigos válidos
        error: message,
      });

    try {
      const { secret_code, job_title } = req.body;

      // ── Validación básica ──────────────────────────────────────────────────
      if (!secret_code || secret_code.trim() === "") {
        return renderError("Debes ingresar un código de acceso.");
      }

      // ── Búsqueda del código en BD ──────────────────────────────────────────
      // findAvailable verifica internamente: existe + !is_used + !expirado
      const inifapCode = await InifapCode.findAvailable(secret_code.trim());

      if (!inifapCode) {
        // 🛡️ Respuesta idéntica para código inexistente, ya usado o expirado
        return renderError("El código de acceso es inválido o ya ha sido utilizado.");
      }

      // ── Transacción atómica: quemar código + escalar privilegios ──────────
      // Si cualquiera de los dos falla, ambos se revierten (consistencia garantizada).
      // No quedará jamás un código quemado con un usuario sin ascender, ni viceversa.
      await sequelize.transaction(async (t) => {
        // Paso 1: Quemar el código (is_used = true, guarda quién y cuándo)
        await inifapCode.burn(req.user.id, { transaction: t });

        // Paso 2: Escalar privilegios del usuario en PostgreSQL
        req.user.role = "inifap";
        req.user.job_title = job_title?.trim() || "Investigador";
        await req.user.save({ transaction: t });
      });

      // El req.user ya está actualizado en memoria → el middleware checkRole
      // lo reconocerá como 'inifap' en la siguiente petición sin re-login
      res.redirect("/dashboard");

    } catch (error) {
      console.error("Error en processUpgrade:", error);
      res.status(500).render("auth/upgrade", {
        title: "Ascenso a Personal INIFAP",
        error: "Error de servidor al procesar el ascenso. Intenta de nuevo.",
      });
    }
  },
};