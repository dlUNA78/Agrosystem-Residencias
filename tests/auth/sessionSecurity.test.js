import { afterAll, jest, describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app, {
  closeAppResources,
  configureTrustProxy,
  resolveSessionCookieSecure,
  resolveTrustProxy,
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

  it('5. Deja trust proxy sin activar por defecto y lo configura condicionalmente con TRUST_PROXY (1.A1)', async () => {
    expect(resolveTrustProxy({})).toBeNull();
    expect(resolveTrustProxy({ TRUST_PROXY: '' })).toBeNull();
    expect(resolveTrustProxy({ TRUST_PROXY: '0' })).toBeNull();
    expect(resolveTrustProxy({ TRUST_PROXY: 'false' })).toBeNull();
    expect(resolveTrustProxy({ TRUST_PROXY: '1' })).toBe(1);
    expect(resolveTrustProxy({ TRUST_PROXY: '2' })).toBe(2);
    expect(resolveTrustProxy({ TRUST_PROXY: 'true' })).toBe(1);

    const directApp = express();
    configureTrustProxy(directApp, {});
    directApp.get('/probe', (req, res) => {
      res.json({ ip: req.ip, secure: req.secure, protocol: req.protocol });
    });

    const directRes = await request(directApp)
      .get('/probe')
      .set('X-Forwarded-For', '203.0.113.195')
      .set('X-Forwarded-Proto', 'https');
    expect(directApp.get('trust proxy')).toBeFalsy();
    expect(directRes.body.ip).not.toBe('203.0.113.195');
    expect(directRes.body.secure).toBe(false);

    const proxiedApp = express();
    configureTrustProxy(proxiedApp, { TRUST_PROXY: '1' });
    proxiedApp.get('/probe', (req, res) => {
      res.json({ ip: req.ip, secure: req.secure, protocol: req.protocol });
    });

    const proxiedRes = await request(proxiedApp)
      .get('/probe')
      .set('X-Forwarded-For', '203.0.113.195')
      .set('X-Forwarded-Proto', 'https');
    expect(proxiedApp.get('trust proxy')).toBe(1);
    expect(proxiedRes.body.ip).toBe('203.0.113.195');
    expect(proxiedRes.body.secure).toBe(true);
    expect(proxiedRes.body.protocol).toBe('https');
  });
});
