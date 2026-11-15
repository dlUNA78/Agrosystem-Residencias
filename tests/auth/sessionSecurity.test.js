import { afterAll, jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app, {
  closeAppResources,
  resolveSessionCookieSecure,
} from '../../app.js';
import {
  authLimiter,
  isRateLimitBypassed,
  upgradeLimiter,
} from '../../src/middlewares/rateLimiter.js';

afterAll(closeAppResources);

describe('🛡️ Pruebas de Seguridad de Sesión y Rate Limiting (Pasos 3 y 4)', () => {
  it('1. Debe aplicar Rate Limiting en Login (authLimiter) tras superar 5 intentos', () => {
    const middleware = authLimiter;
    const req = {
      ip: '192.168.1.50',
      path: '/auth/login',
      query: { rateLimitTest: '1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    // Simulamos 5 peticiones exitosas
    for (let i = 0; i < 5; i++) {
      middleware(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(5);

    // La sexta petición debe ser bloqueada con 429
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Demasiados intentos de inicio de sesión'),
    );
  });

  it('2. Debe aplicar Rate Limiting en Upgrade (upgradeLimiter) tras superar 3 intentos', () => {
    const middleware = upgradeLimiter;
    const req = {
      ip: '192.168.1.60',
      path: '/auth/inifap-upgrade',
      query: { rateLimitTest: '1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    // Simulamos 3 peticiones exitosas
    for (let i = 0; i < 3; i++) {
      middleware(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(3);

    // La cuarta petición debe ser bloqueada con 429
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Demasiados intentos de canje'),
    );
  });

  it('3. Debe responder 401 ante credenciales incorrectas en POST /auth/login', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'fake@user.com', password: 'WrongPassword' });

    expect(response.status).toBe(401);
    expect(response.text).toContain('Credenciales incorrectas');
  });

  it('4. Mantiene cookie.secure seguro por defecto y respeta COOKIE_SECURE / DISABLE_RATE_LIMIT explícitos', () => {
    expect(resolveSessionCookieSecure({ NODE_ENV: 'production' })).toBe(true);
    expect(resolveSessionCookieSecure({ NODE_ENV: 'development' })).toBe(false);
    expect(
      resolveSessionCookieSecure({
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false',
      }),
    ).toBe(false);
    expect(
      resolveSessionCookieSecure({
        NODE_ENV: 'development',
        COOKIE_SECURE: 'true',
      }),
    ).toBe(true);

    expect(isRateLimitBypassed({}, { NODE_ENV: 'production' })).toBe(false);
    expect(
      isRateLimitBypassed(
        {},
        { NODE_ENV: 'production', DISABLE_RATE_LIMIT: 'true' },
      ),
    ).toBe(true);
    expect(
      isRateLimitBypassed(
        { query: { rateLimitTest: '1' } },
        { NODE_ENV: 'production', DISABLE_RATE_LIMIT: 'true' },
      ),
    ).toBe(false);
  });
});
