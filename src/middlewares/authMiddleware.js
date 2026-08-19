// Verificar que el usuario tenga sesión activa
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};

/**
 * Middleware RBAC Granular: Verifica si el usuario autenticado posee alguno de los roles autorizados.
 * Si no cumple con el rol, responde con 403 Forbidden.
 * @param  {...string} allowedRoles Roles autorizados (ej: 'admin', 'inifap', 'agricultor')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    if (!allowedRoles.includes(req.user.role)) {
      const isJsonRequest =
        req.xhr ||
        req.path?.startsWith('/api/') ||
        req.headers?.accept?.includes('application/json');

      if (isJsonRequest) {
        return res.status(403).json({
          error: 'Forbidden',
          message:
            'Acceso Denegado: No posees los privilegios suficientes para realizar esta acción.',
        });
      }

      return res
        .status(403)
        .send(
          'Error 403: Acceso Denegado. No posees los privilegios requeridos para acceder a esta área.',
        );
    }

    next();
  };
};

// Bloqueo del panel privado exclusivo a personal INIFAP o Administradores
export const requirePanelAccess = requireRole('inifap', 'admin');
