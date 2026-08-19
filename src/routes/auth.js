import express from 'express';
import passport from 'passport';
import { authController } from '../controllers/authController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import { authLimiter, upgradeLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// --- RUTAS DE REGISTRO ---
router.get('/register', authController.showRegister);
router.post('/register', authController.register);

// --- RUTAS DE LOGIN ---
router.get('/login', authController.showLogin);

// Autenticación con Passport + Anti Fuerza Bruta + Regeneración de ID de Sesión (Anti-Session Fixation)
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Iniciar Sesión',
        error: info?.message || 'Credenciales incorrectas.',
      });
    }

    const completeLogin = () => {
      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.redirect('/');
      });
    };

    // 🛡️ Regenerar el ID de sesión ANTES de guardar las credenciales de Passport
    if (req.session && typeof req.session.regenerate === 'function') {
      req.session.regenerate((err) => {
        if (err) return next(err);
        completeLogin();
      });
    } else {
      completeLogin();
    }
  })(req, res, next);
});

// --- RUTA DE CERRAR SESIÓN ---
router.get('/logout', authController.logout);

// --- ASCENSO A PERSONAL INIFAP (UPGRADE) ---
router.get('/inifap-upgrade', isAuthenticated, authController.showUpgrade);
router.post(
  '/inifap-upgrade',
  isAuthenticated,
  upgradeLimiter,
  authController.processUpgrade,
);

export default router;
