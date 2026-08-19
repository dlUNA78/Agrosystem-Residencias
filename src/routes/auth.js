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

// Autenticación con Passport + Anti Fuerza Bruta + Regeneración de ID de Sesión
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).render('auth/login', {
        title: 'Iniciar Sesión',
        error: info?.message || 'Credenciales incorrectas.',
      });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);

      // 🛡️ Regenerar ID de sesión para prevenir ataques de Session Fixation
      if (req.session && typeof req.session.regenerate === 'function') {
        req.session.regenerate((err) => {
          if (err) return next(err);
          return res.redirect('/');
        });
      } else {
        return res.redirect('/');
      }
    });
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
