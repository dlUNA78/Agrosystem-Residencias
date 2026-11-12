import {
  getRequiredProductPermissionForWorkflowAction,
  hasProductPermission,
} from '../services/productAuthorizationService.js';
import { sendForbiddenResponse } from '../utils/errorRenderer.js';

export const requireProductPermission = (permission) => (req, res, next) => {
  if (!req.user) return res.redirect('/auth/login');

  if (!hasProductPermission(req.user.role, permission)) {
    const message =
      'Acceso denegado: no tienes permiso para realizar esta acción sobre productos.';
    return sendForbiddenResponse(req, res, message);
  }

  return next();
};

export const requireProductWorkflowPermission = (req, res, next) => {
  const permission = getRequiredProductPermissionForWorkflowAction(
    req.body?.action,
  );
  if (!permission) return res.status(400).send('Acción de workflow no válida.');
  return requireProductPermission(permission)(req, res, next);
};
