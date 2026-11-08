import { Router } from 'express';

import {
  isAuthenticated,
  requirePanelAccess,
} from '../middlewares/authMiddleware.js';
import { dashboard } from '../controllers/private/dashboardController.js';
import {
  renderProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  revokeOtherSessionsHandler,
} from '../controllers/private/profileController.js';
import { uploadAvatarImage } from '../middlewares/upload.js';

import catalogRoutes from './private/catalogRoutes.js';
import landRoutes from './private/landRoutes.js';
import adminRoutes from './private/adminRoutes.js';

const privateRouter = Router();

// Aplica el middleware de verificación de sesión activa únicamente a las rutas protegidas
privateRouter.use(['/profile', '/dashboard', '/private'], isAuthenticated);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PERFIL PÚBLICO (Accesible para cualquier usuario autenticado)
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/profile', renderProfile);
privateRouter.post('/profile', updateProfile);
privateRouter.post('/profile/avatar', uploadAvatarImage, updateAvatar);
privateRouter.post('/profile/password', changePassword);
privateRouter.post(
  '/profile/sessions/revoke-others',
  revokeOtherSessionsHandler,
);

// Aplica el bloqueo del panel privado (Solo INIFAP y Admin a partir de este punto)
privateRouter.use(['/dashboard', '/private'], requirePanelAccess);

// Perfil dentro del Panel Privado (Solo INIFAP y Admin)
privateRouter.get('/private/profile', renderProfile);
privateRouter.post('/private/profile', updateProfile);
privateRouter.post('/private/profile/avatar', uploadAvatarImage, updateAvatar);
privateRouter.post('/private/profile/password', changePassword);
privateRouter.post(
  '/private/profile/sessions/revoke-others',
  revokeOtherSessionsHandler,
);

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
