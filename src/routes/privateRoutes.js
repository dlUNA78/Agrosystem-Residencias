import { Router } from 'express';

import {
  isAuthenticated,
  requirePanelAccess,
} from '../middlewares/authMiddleware.js';
import { dashboard } from '../controllers/private/dashboardController.js';
import {
  renderProfile,
  updateProfile,
} from '../controllers/private/usersController.js';

import catalogRoutes from './private/catalogRoutes.js';
import landRoutes from './private/landRoutes.js';
import adminRoutes from './private/adminRoutes.js';

const privateRouter = Router();

// Aplica el middleware de verificación de sesión activa a TODAS las rutas
privateRouter.use(isAuthenticated);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PERFIL PÚBLICO (Accesible para cualquier usuario autenticado)
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/profile', renderProfile);
privateRouter.post('/profile', updateProfile);

// Aplica el bloqueo del panel privado (Solo INIFAP y Admin a partir de este punto)
privateRouter.use(requirePanelAccess);

// Perfil dentro del Panel Privado (Solo INIFAP y Admin)
privateRouter.get('/private/profile', renderProfile);
privateRouter.post('/private/profile', updateProfile);

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/dashboard', dashboard);

// ══════════════════════════════════════════════════════════════════════════════
// ROUTERS POR DOMINIO
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.use(catalogRoutes);
privateRouter.use(landRoutes);
privateRouter.use(adminRoutes);

export default privateRouter;
