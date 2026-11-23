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
import {
  SESSION_ACTIVITY_THROTTLE_MS,
  enrichSessionActivity,
} from '../../src/services/sessionManagementService.js';

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
    ).toBe(false);
    expect(
      isRateLimitBypassed(
        {},
        {
          NODE_ENV: 'production',
          DISABLE_RATE_LIMIT: 'true',
          LOADTEST_MODE: 'true',
        },
      ),
    ).toBe(true);
    expect(
      isRateLimitBypassed(
        { query: { rateLimitTest: '1' } },
        {
          NODE_ENV: 'production',
          DISABLE_RATE_LIMIT: 'true',
          LOADTEST_MODE: 'true',
        },
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

  it('6. Aplica throttling de 5 min en enrichSessionActivity, respeta TRUST_PROXY y escribe de inmediato al cambiar IP o User-Agent (1.A6)', async () => {
    expect(SESSION_ACTIVITY_THROTTLE_MS).toBe(5 * 60 * 1000);

    const t0 = Date.parse('2026-11-22T12:00:00.000Z');
    const req = {
      ip: '198.51.100.10',
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/120.0' },
      user: { id: 1 },
      session: {},
    };

    // Primera actividad siempre actualiza
    expect(enrichSessionActivity(req, { now: t0 })).toBe(true);
    expect(req.session.clientIp).toBe('198.51.100.10');
    expect(req.session.userAgent).toBe('Mozilla/5.0 Chrome/120.0');
    expect(req.session.lastActive).toBe('2026-11-22T12:00:00.000Z');

    // Dentro de la ventana de 5 min sin cambios: NO muta la sesión
    expect(enrichSessionActivity(req, { now: t0 + 4 * 60 * 1000 })).toBe(false);
    expect(req.session.lastActive).toBe('2026-11-22T12:00:00.000Z');

    // Cambio de IP dentro de la ventana: escribe de inmediato
    req.ip = '198.51.100.20';
    expect(enrichSessionActivity(req, { now: t0 + 4 * 60 * 1000 + 5000 })).toBe(
      true,
    );
    expect(req.session.clientIp).toBe('198.51.100.20');
    expect(req.session.lastActive).toBe('2026-11-22T12:04:05.000Z');

    // Cambio de User-Agent dentro de la ventana: escribe de inmediato
    req.headers['user-agent'] = 'Mozilla/5.0 Firefox/122.0';
    expect(
      enrichSessionActivity(req, { now: t0 + 4 * 60 * 1000 + 10000 }),
    ).toBe(true);
    expect(req.session.userAgent).toBe('Mozilla/5.0 Firefox/122.0');
    expect(req.session.lastActive).toBe('2026-11-22T12:04:10.000Z');

    // Al cumplirse >= 5 min desde el último guardado: escribe de nuevo
    const tAfter5Min =
      Date.parse(req.session.lastActive) + SESSION_ACTIVITY_THROTTLE_MS;
    expect(enrichSessionActivity(req, { now: tAfter5Min })).toBe(true);
    expect(req.session.lastActive).toBe(new Date(tAfter5Min).toISOString());

    // Integración con Express: sin TRUST_PROXY ignora X-Forwarded-For; con TRUST_PROXY=1 la respeta
    const directApp = express();
    configureTrustProxy(directApp, {});
    directApp.get('/activity', (r, res) => {
      r.user = { id: 1 };
      r.session = {};
      enrichSessionActivity(r);
      res.json({ clientIp: r.session.clientIp });
    });

    const directActivity = await request(directApp)
      .get('/activity')
      .set('X-Forwarded-For', '203.0.113.200');
    expect(directActivity.body.clientIp).not.toBe('203.0.113.200');

    const proxiedApp = express();
    configureTrustProxy(proxiedApp, { TRUST_PROXY: '1' });
    const sharedSession = {};
    proxiedApp.get('/activity', (r, res) => {
      r.user = { id: 1 };
      r.session = sharedSession;
      const updated = enrichSessionActivity(r);
      res.json({ updated, clientIp: r.session.clientIp });
    });

    const firstProxied = await request(proxiedApp)
      .get('/activity')
      .set('X-Forwarded-For', '203.0.113.200')
      .set('User-Agent', 'AgroTest/1.0');
    expect(firstProxied.body).toEqual({
      updated: true,
      clientIp: '203.0.113.200',
    });

    const secondSameIp = await request(proxiedApp)
      .get('/activity')
      .set('X-Forwarded-For', '203.0.113.200')
      .set('User-Agent', 'AgroTest/1.0');
    expect(secondSameIp.body).toEqual({
      updated: false,
      clientIp: '203.0.113.200',
    });

    const thirdChangedIp = await request(proxiedApp)
      .get('/activity')
      .set('X-Forwarded-For', '198.51.100.77')
      .set('User-Agent', 'AgroTest/1.0');
    expect(thirdChangedIp.body).toEqual({
      updated: true,
      clientIp: '198.51.100.77',
    });
  });
});
