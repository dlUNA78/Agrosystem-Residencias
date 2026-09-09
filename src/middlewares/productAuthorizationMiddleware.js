import {
  getRequiredProductPermissionForWorkflowAction,
  hasProductPermission,
} from '../services/productAuthorizationService.js';

const isJsonRequest = (req) =>
  req.xhr || req.headers?.accept?.includes('application/json');

export const requireProductPermission = (permission) => (req, res, next) => {
  if (!req.user) return res.redirect('/auth/login');

  if (!hasProductPermission(req.user.role, permission)) {
    const message =
      'Acceso denegado: no tienes permiso para realizar esta acción sobre productos.';
    if (isJsonRequest(req)) {
      return res.status(403).json({ error: 'Forbidden', message });
    }
    return res.status(403).send(message);
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
