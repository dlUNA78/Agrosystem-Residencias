import {
  hasEffectivePermission,
  PANEL_PERMISSIONS,
} from '../services/rbacService.js';
import { sendForbiddenResponse } from '../utils/errorRenderer.js';

// Verificar que el usuario tenga sesión activa
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.redirect('/auth/login');
};

const hasSpecificDelegatedPermission = (req) => {
  if (!req.user) return false;
  const path = req.path || '';
  if (
    path.includes('/ingredients') &&
    hasEffectivePermission(req.user, PANEL_PERMISSIONS.INGREDIENTS_MANAGE)
  ) {
    return true;
  }
  return false;
};

/**
 * Middleware RBAC Granular: Verifica si el usuario autenticado posee alguno de los roles autorizados
 * o cuenta con una delegación de permisos específica.
 * Si no cumple, responde con 403 Forbidden.
 * @param  {...string} allowedRoles Roles autorizados (ej: 'admin', 'inifap', 'agricultor')
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    if (
      allowedRoles.includes(req.user.role) ||
      hasSpecificDelegatedPermission(req)
    ) {
      return next();
    }

    return sendForbiddenResponse(
      req,
      res,
      'Error 403: Acceso Denegado. No posees los privilegios requeridos para acceder a esta área.',
    );
  };
};

/**
 * Middleware para exigir un permiso granular puntual del catálogo RBAC
 * @param {string} permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    if (!hasEffectivePermission(req.user, permission)) {
      return sendForbiddenResponse(
        req,
        res,
        'Error 403: Acceso Denegado por política de permisos.',
      );
    }

    return next();
  };
};

// Bloqueo del panel privado exclusivo a personal INIFAP o Administradores
export const requirePanelAccess = requireRole('inifap', 'admin');
