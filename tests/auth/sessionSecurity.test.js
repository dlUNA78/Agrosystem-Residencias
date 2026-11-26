import { afterAll, jest, describe, it, expect } from '@jest/globals';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import app, {
  buildSessionClearCookieOptions,
  buildSessionCookieOptions,
  closeAppResources,
  configureTrustProxy,
  createAbsoluteSessionExpirationMiddleware,
  isSessionAbsolutelyExpired,
  resolveSessionCookieSecure,
  resolveTrustProxy,
  SESSION_ABSOLUTE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from '../../app.js';
import { authController } from '../../src/controllers/authController.js';
import {
  authLimiter,
  isRateLimitBypassed,
  upgradeLimiter,
} from '../../src/middlewares/rateLimiter.js';
import db from '../../src/models/index.js';
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

  it('7. Configura cookie personalizada agrosystem.sid, SameSite=Lax explícito, opciones compartidas y clearCookie con Secure en logout (1.A5)', async () => {
    expect(SESSION_COOKIE_NAME).toBe('agrosystem.sid');
    expect(SESSION_COOKIE_NAME).not.toBe('connect.sid');
    expect(SESSION_ABSOLUTE_MAX_AGE_MS).toBeGreaterThanOrEqual(
      7 * 24 * 60 * 60 * 1000,
    );

    const devCookieOpts = buildSessionCookieOptions({
      NODE_ENV: 'development',
    });
    const devClearOpts = buildSessionClearCookieOptions({
      NODE_ENV: 'development',
    });
    expect(devCookieOpts).toEqual({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });
    expect(devClearOpts).toEqual({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
    expect(devClearOpts).not.toHaveProperty('maxAge');
    expect(devClearOpts).not.toHaveProperty('expires');

    const prodClearOpts = buildSessionClearCookieOptions({
      NODE_ENV: 'production',
    });
    expect(prodClearOpts).toEqual({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
    expect(
      buildSessionCookieOptions({
        NODE_ENV: 'development',
        COOKIE_SECURE: 'true',
      }).secure,
    ).toBe(true);

    expect(app.get('sessionCookieName')).toBe(SESSION_COOKIE_NAME);
    expect(app.get('sessionClearCookieOptions')).toEqual(
      buildSessionClearCookieOptions(),
    );

    // Verifica que authController.logout emita Secure cuando la configuración de sesión tiene secure: true
    const secureLogoutApp = express();
    secureLogoutApp.set('sessionCookieName', SESSION_COOKIE_NAME);
    secureLogoutApp.set('sessionClearCookieOptions', prodClearOpts);
    secureLogoutApp.post('/auth/logout', (req, res, next) => {
      req.logout = (cb) => cb(null);
      req.session = { destroy: (cb) => cb(null) };
      return authController.logout(req, res, next);
    });

    const secureLogoutRes = await request(secureLogoutApp).post('/auth/logout');
    expect(secureLogoutRes.status).toBe(302);
    expect(secureLogoutRes.headers.location).toBe('/auth/login');
    const clearedHeader = (secureLogoutRes.headers['set-cookie'] || []).find(
      (c) => c.startsWith(`${SESSION_COOKIE_NAME}=;`),
    );
    expect(clearedHeader).toBeDefined();
    expect(clearedHeader).toMatch(/Path=\//i);
    expect(clearedHeader).toMatch(/HttpOnly/i);
    expect(clearedHeader).toMatch(/SameSite=Lax/i);
    expect(clearedHeader).toMatch(/Secure/i);
    expect(clearedHeader).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  });

  it('8. Aplica expiración absoluta máxima (>= 7 días) en middleware sin mutar sesiones vigentes (1.A5)', () => {
    const t0 = Date.parse('2026-11-01T00:00:00.000Z');
    const beforeLimit = t0 + SESSION_ABSOLUTE_MAX_AGE_MS - 1;
    const atLimit = t0 + SESSION_ABSOLUTE_MAX_AGE_MS;

    expect(
      isSessionAbsolutelyExpired(
        { sessionCreatedAt: t0 },
        { now: beforeLimit },
      ),
    ).toBe(false);
    expect(
      isSessionAbsolutelyExpired({ sessionCreatedAt: t0 }, { now: atLimit }),
    ).toBe(true);

    let currentNow = t0;
    const clearOpts = buildSessionClearCookieOptions({
      NODE_ENV: 'production',
    });
    const middleware = createAbsoluteSessionExpirationMiddleware({
      nowProvider: () => currentNow,
      cookieName: SESSION_COOKIE_NAME,
      clearCookieOptions: clearOpts,
    });

    const session = { destroy: jest.fn((cb) => cb(null)) };
    const req = { user: { id: 42 }, session };
    const res = { clearCookie: jest.fn() };
    const next = jest.fn();

    // Primera petición autenticada: sella sessionCreatedAt
    middleware(req, res, next);
    expect(session.sessionCreatedAt).toBe(t0);
    expect(session.destroy).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);

    // Antes de 7 días: sigue vigente sin destruir sesión
    currentNow = beforeLimit;
    middleware(req, res, next);
    expect(req.user).toEqual({ id: 42 });
    expect(session.destroy).not.toHaveBeenCalled();
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(2);

    // Al alcanzar 7 días: destruye sesión, limpia req.user y borra la cookie con las mismas opciones
    currentNow = atLimit;
    middleware(req, res, next);
    expect(req.user).toBeNull();
    expect(session.destroy).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      clearOpts,
    );
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('9. Mantiene válida una sesión activa antes de 7 días y la destruye en PostgreSQL al superar 7 días aunque maxAge se haya renovado (1.A5)', async () => {
    const { User, sequelize } = db;
    const email = `abs_exp_${Date.now()}@agrosystem.test`;
    const password = 'ValidPassword123';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name: 'Usuario Expiracion Absoluta',
      email,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    try {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/auth/login')
        .send({ email, password });
      expect(loginRes.status).toBe(302);

      const loginCookies = loginRes.headers['set-cookie'] || [];
      const issuedCookie = loginCookies.find((c) =>
        c.startsWith(`${SESSION_COOKIE_NAME}=`),
      );
      expect(issuedCookie).toBeDefined();
      expect(issuedCookie).toMatch(/SameSite=Lax/i);
      expect(issuedCookie).toMatch(/HttpOnly/i);
      expect(loginCookies.some((c) => c.startsWith('connect.sid='))).toBe(
        false,
      );

      // Primera petición autenticada: persiste sessionCreatedAt en PostgreSQL
      const firstDashboard = await agent.get('/dashboard');
      expect(firstDashboard.status).toBe(200);

      const [[sessionRow]] = await sequelize.query(
        `SELECT sid, sess, expire
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
           AND expire > NOW()
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(user.id) } },
      );
      expect(sessionRow).toBeDefined();
      expect(Number.isFinite(sessionRow.sess.sessionCreatedAt)).toBe(true);

      // Envejecemos sessionCreatedAt a 7 días - 60s (con expire +24h vigente): debe seguir activa
      const validCreatedAt =
        Date.now() - (SESSION_ABSOLUTE_MAX_AGE_MS - 60_000);
      const renewedExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: sessionRow.sid,
            sess: JSON.stringify({
              ...sessionRow.sess,
              sessionCreatedAt: validCreatedAt,
              lastActive: new Date().toISOString(),
            }),
            expire: renewedExpire,
          },
        },
      );

      const stillValidRes = await agent.get('/dashboard');
      expect(stillValidRes.status).toBe(200);

      // Envejecemos sessionCreatedAt a 7 días + 60s manteniendo expire +24h y lastActive reciente
      const expiredCreatedAt =
        Date.now() - (SESSION_ABSOLUTE_MAX_AGE_MS + 60_000);
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: sessionRow.sid,
            sess: JSON.stringify({
              ...sessionRow.sess,
              sessionCreatedAt: expiredCreatedAt,
              lastActive: new Date().toISOString(),
            }),
            expire: renewedExpire,
          },
        },
      );

      const expiredRes = await agent.get('/dashboard');
      expect(expiredRes.status).toBe(302);
      expect(expiredRes.headers.location).toBe('/auth/login');

      const expiredClearCookie = (expiredRes.headers['set-cookie'] || []).find(
        (c) => c.startsWith(`${SESSION_COOKIE_NAME}=;`),
      );
      expect(expiredClearCookie).toBeDefined();
      expect(expiredClearCookie).toMatch(/Path=\//i);
      expect(expiredClearCookie).toMatch(/HttpOnly/i);
      expect(expiredClearCookie).toMatch(/SameSite=Lax/i);
      expect(expiredClearCookie).toMatch(
        /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i,
      );

      const [remainingRows] = await sequelize.query(
        'SELECT sid FROM "session" WHERE sid = :sid',
        { replacements: { sid: sessionRow.sid } },
      );
      expect(remainingRows).toHaveLength(0);
    } finally {
      await sequelize.query(
        `DELETE FROM "session" WHERE (sess -> 'passport' ->> 'user') = :uid`,
        { replacements: { uid: String(user.id) } },
      );
      await user.destroy();
    }
  });
});
