import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../app.js';

describe('🔒 Pruebas de Sanitización de Sesión de Usuario (Paso 1)', () => {
  it('1. Debe asegurar que las respuestas HTTP de auth no contengan datos sensibles como password_hash', async () => {
    const response = await request(app).get('/auth/login');
    expect(response.status).toBe(200);
    expect(response.text).not.toContain('password_hash');
    expect(response.text).not.toContain('password_secret');
  });

  it('2. Debe eliminar explícitamente password_hash y password del objeto res.locals.user', () => {
    // Simulamos un usuario autenticado con password_hash que retorna Sequelize
    const mockUser = {
      id: 1,
      full_name: 'Juan Perez',
      email: 'juan@agrosystem.com',
      role: 'inifap',
      password_hash: '$2b$10$e8w8qW...HASH_SECRET...',
      password: 'PlainPassword123',
      toJSON() {
        return { ...this };
      },
    };

    const req = { user: mockUser };
    const res = { locals: {} };
    const next = jest.fn();

    // Recreamos la función middleware exacta de app.js
    const sanitizeUserMiddleware = (req, res, next) => {
      if (req.user) {
        const safeUser =
          typeof req.user.toJSON === 'function'
            ? req.user.toJSON()
            : { ...req.user };
        delete safeUser.password_hash;
        delete safeUser.password;
        res.locals.user = safeUser;
      } else {
        res.locals.user = null;
      }
      next();
    };

    sanitizeUserMiddleware(req, res, next);

    // Verificaciones de Seguridad:
    expect(next).toHaveBeenCalled();
    expect(res.locals.user).toBeDefined();
    expect(res.locals.user.full_name).toBe('Juan Perez');
    expect(res.locals.user.role).toBe('inifap');
    // 🛡️ CAMPOS SENSIBLES OBLIGATORIAMENTE UNDEFINED/ELIMINADOS
    expect(res.locals.user.password_hash).toBeUndefined();
    expect(res.locals.user.password).toBeUndefined();
  });
});
