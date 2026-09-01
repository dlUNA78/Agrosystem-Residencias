import {
  getRequiredPlaguePermissionForWorkflowAction,
  hasPlaguePermission,
} from '../services/plagueAuthorizationService.js';

const isJsonRequest = (req) => {
  return (
    req.xhr ||
    req.path?.startsWith('/api/') ||
    req.headers?.accept?.includes('application/json')
  );
};

export const requirePlaguePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    if (!hasPlaguePermission(req.user.role, permission)) {
      const message =
        'Acceso denegado: no tienes permiso para realizar esta acción sobre plagas.';

      if (isJsonRequest(req)) {
        return res.status(403).json({ error: 'Forbidden', message });
      }

      return res.status(403).send(message);
    }

    return next();
  };
};

export const requirePlagueWorkflowPermission = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }

  const permission = getRequiredPlaguePermissionForWorkflowAction(
    req.body?.action,
  );

  if (!permission) {
    return res.status(400).send('Acción de workflow no válida.');
  }

  return requirePlaguePermission(permission)(req, res, next);
};
