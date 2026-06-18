import express from 'express';
import passport from 'passport';
import { authController } from '../controllers/authController.js';

const router = express.Router();

// --- RUTAS DE REGISTRO ---
router.get('/register', authController.showRegister);
router.post('/register', authController.register);

// --- RUTAS DE LOGIN ---
router.get('/login', authController.showLogin);


// Usamos el middleware de Passport. Si falla, lo devuelve al login. Si acierta, va al inicio.
router.post('/login', passport.authenticate('local', {
  successRedirect: '/', // A dónde ir si el login es exitoso
  failureRedirect: '/login', // A dónde ir si se equivoca de contraseña
  // failureFlash: true // (Opcional a futuro para mostrar mensajes de error rojos en la vista)
}));

// --- RUTA DE CERRAR SESIÓN ---
router.get('/logout', authController.logout);

export default router;