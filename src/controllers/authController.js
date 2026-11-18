import bcrypt from 'bcrypt';
import db from '../models/index.js';
import {
  createNotification,
  notifyAdmins,
} from '../services/notificationService.js';
import {
  sanitizeText,
  isValidEmail,
  isValidPersonName,
  validatePasswordPolicy,
} from '../utils/validators.js';

const { User, InifapCode, sequelize } = db;

const REGISTER_EXTRA_SCRIPTS = '<script src="/js/public/register.js"></script>';

const extractUpgradeParams = (body = {}) => ({
  rawCode: String(body.secret_code || body.inifap_code || '').trim(),
  jobTitle: sanitizeText(body.job_title, 100),
  shift: sanitizeText(body.shift, 40),
});

const renderUpgradeError = (res, message, status = 401) =>
  res.status(status).render('auth/upgrade', {
    title: 'Ascenso a Personal INIFAP',
    error: message,
  });

const applyUpgradeTransaction = async (user, inifapCode, jobTitle, shift) => {
  await sequelize.transaction(async (t) => {
    await inifapCode.burn(user.id, { transaction: t });
    user.role = 'inifap';
    if (inifapCode.rbac_role_id) {
      user.rbac_role_id = inifapCode.rbac_role_id;
    }
    user.job_title = jobTitle || 'Investigador';
    if (shift) {
      user.shift = shift;
    }
    await user.save({ transaction: t });
  });
};

const notifyUpgradeCompleted = async (user, codeStr) => {
  await createNotification({
    userId: user.id,
    category: 'sistema',
    severity: 'success',
    title: 'Ascenso Institucional Exitoso',
    message: 'Has sido promovido exitosamente a Personal Técnico INIFAP.',
    actionUrl: '/dashboard',
  });

  await notifyAdmins({
    actorId: user.id,
    category: 'rbac',
    severity: 'info',
    title: 'Canje de Código INIFAP',
    message: `El usuario ${user.full_name || user.email} canjeó el código institucional ${codeStr}.`,
    actionUrl: '/private/users',
  });
};

const completeUpgradeSessionAndRedirect = (req, res, next) => {
  if (req.session && typeof req.session.regenerate === 'function') {
    req.session.regenerate((err) => {
      if (err) console.error('Error regenerando sesión en upgrade:', err);
      req.logIn(req.user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.redirect('/dashboard');
      });
    });
    return;
  }
  res.redirect('/dashboard');
};

const renderRegisterError = (res, error, formData = {}) =>
  res.status(400).render('auth/register', {
    title: 'Registrarse en INIFAP',
    error,
    formData,
    extraScripts: REGISTER_EXTRA_SCRIPTS,
  });

const validateRegistrationPayload = ({ full_name, email, password }) => {
  if (!full_name || !email || !password) {
    return 'Todos los campos son obligatorios.';
  }
  if (!isValidPersonName(full_name)) {
    return 'El nombre completo solo puede contener letras y espacios (mínimo 2 caracteres).';
  }
  if (!isValidEmail(email)) {
    return 'Ingresa un formato de correo electrónico válido.';
  }
  const pwdCheck = validatePasswordPolicy(password);
  if (!pwdCheck.valid) {
    return `Contraseña insegura: ${pwdCheck.errors.join(' ')}`;
  }
  return null;
};

export const authController = {
  // ─── VISTAS ────────────────────────────────────────────────────────────────

  showRegister: (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/');
    }
    res.render('auth/register', {
      title: 'Registrarse en INIFAP',
      extraScripts: REGISTER_EXTRA_SCRIPTS,
    });
  },

  showLogin: (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/');
    }
    res.render('auth/login', {
      title: 'Iniciar Sesión',
      extraScripts: '<script src="/js/public/login.js"></script>',
    });
  },

  // ─── LÓGICA DE NEGOCIO ─────────────────────────────────────────────────────

  register: async (req, res) => {
    try {
      const cleanName = sanitizeText(req.body?.full_name, 120);
      const cleanEmail = sanitizeText(req.body?.email, 150).toLowerCase();
      const rawPassword = req.body?.password || '';
      const formData = { full_name: cleanName, email: cleanEmail };

      const validationError = validateRegistrationPayload({
        full_name: cleanName,
        email: cleanEmail,
        password: rawPassword,
      });
      if (validationError) {
        return renderRegisterError(res, validationError, formData);
      }

      const existingUser = await User.findOne({ where: { email: cleanEmail } });
      if (existingUser) {
        return renderRegisterError(
          res,
          'Este correo electrónico ya está registrado.',
          formData,
        );
      }

      const saltRounds = 10;
      const password_hash = await bcrypt.hash(rawPassword, saltRounds);

      await User.create({
        full_name: cleanName,
        email: cleanEmail,
        password_hash,
        role: 'agricultor',
      });

      res.redirect('/auth/login');
    } catch (error) {
      console.error('CRITICAL ERROR en authController.register:', error);
      res.status(500).render('auth/register', {
        title: 'Registrarse en INIFAP',
        error:
          'Error interno del servidor. Por favor contacte al administrador.',
        extraScripts: REGISTER_EXTRA_SCRIPTS,
      });
    }
  },

  // ─── DESTRUCCIÓN DE SESIÓN ─────────────────────────────────────────────────

  logout: (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);

      // Destruimos explícitamente la sesión para que el gafete pierda validez
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/auth/login');
      });
    });
  },

  // ─── FLUJO DE ASCENSO: AGRICULTOR → INIFAP (UPGRADE) ──────────────────────

  showUpgrade: (req, res) => {
    // Si ya es INIFAP o Admin, no tiene nada que hacer aquí
    if (req.user.role === 'inifap' || req.user.role === 'admin') {
      return res.redirect('/dashboard');
    }
    res.render('auth/upgrade', {
      title: 'Ascenso a Personal INIFAP',
      error: null,
    });
  },

  processUpgrade: async (req, res, next) => {
    try {
      const { rawCode, jobTitle, shift } = extractUpgradeParams(req.body);
      if (!rawCode) {
        return renderUpgradeError(res, 'Debes ingresar un código de acceso.');
      }

      const inifapCode = await InifapCode.findAvailable(rawCode);
      if (!inifapCode) {
        return renderUpgradeError(
          res,
          'El código de acceso es inválido o ya ha sido utilizado.',
        );
      }

      await applyUpgradeTransaction(req.user, inifapCode, jobTitle, shift);
      await notifyUpgradeCompleted(req.user, inifapCode.code);
      return completeUpgradeSessionAndRedirect(req, res, next);
    } catch (error) {
      console.error('Error en processUpgrade:', error);
      return renderUpgradeError(
        res,
        'Error de servidor al procesar el ascenso. Intenta de nuevo.',
        500,
      );
    }
  },
};
