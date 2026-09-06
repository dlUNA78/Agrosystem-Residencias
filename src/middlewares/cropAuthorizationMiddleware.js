import {
  getRequiredCropPermissionForWorkflowAction,
  hasCropPermission,
} from '../services/cropAuthorizationService.js';

const isJsonRequest = (req) =>
  req.xhr ||
  req.path?.startsWith('/api/') ||
  req.headers?.accept?.includes('application/json');

export const requireCropPermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }

  if (!hasCropPermission(req.user.role, permission)) {
    const message =
      'Acceso denegado: no tienes permiso para realizar esta acción sobre cultivos.';

    if (isJsonRequest(req)) {
      return res.status(403).json({ error: 'Forbidden', message });
    }

    return res.status(403).send(message);
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
