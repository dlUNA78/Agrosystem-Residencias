import { jest, describe, it, expect } from '@jest/globals';
import {
  requireRole,
  requirePanelAccess,
} from '../../src/middlewares/authMiddleware.js';

describe('🛡️ Pruebas de Control de Acceso Granular por Rol (Paso 2 - RBAC)', () => {
  it('1. Debe permitir el acceso si el usuario posee un rol autorizado', () => {
    const middleware = requireRole('admin');
    const req = { user: { role: 'admin' }, path: '/private/users' };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('2. Debe denegar el acceso (403) a un usuario INIFAP cuando se requiere rol ADMIN exclusivamente', () => {
    const middleware = requireRole('admin');
    const req = { user: { role: 'inifap' }, path: '/private/audit' };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Acceso Denegado'),
    );
  });

  it('3. Debe denegar el acceso (403) a un AGRICULTOR en el panel privado (requirePanelAccess)', () => {
    const req = { user: { role: 'agricultor' }, path: '/private/lands' };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    requirePanelAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('4. Debe retornar JSON 403 cuando la petición no autorizada proviene de una API o AJAX', () => {
    const middleware = requireRole('admin');
    const req = {
      user: { role: 'inifap' },
      path: '/api/admin/action',
      headers: { accept: 'application/json' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' }),
    );
  });

  it('5. Debe redirigir a /auth/login si req.user es undefined (usuario no autenticado)', () => {
    const middleware = requireRole('admin', 'inifap');
    const req = { user: undefined, path: '/private/lands' };
    const res = {
      redirect: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
  });
});
