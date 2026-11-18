import {
  getRequiredCropPermissionForWorkflowAction,
  hasCropPermission,
} from '../services/cropAuthorizationService.js';
import { sendForbiddenResponse } from '../utils/errorRenderer.js';

export const requireCropPermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }

  if (!hasCropPermission(req.user.role, permission)) {
    const message =
      'Acceso denegado: no tienes permiso para realizar esta acción sobre cultivos.';
    return sendForbiddenResponse(req, res, message);
  }

  return next();
};

export const requireCropWorkflowPermission = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }

  const permission = getRequiredCropPermissionForWorkflowAction(
    req.body?.action,
  );

  if (!permission) {
    return res.status(400).send('Acción de workflow no válida.');
  }

  return requireCropPermission(permission)(req, res, next);
};
