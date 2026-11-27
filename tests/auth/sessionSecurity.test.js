import crypto from 'node:crypto';
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

    // Petición no autenticada: no muta la sesión ni limpia cookies
    const anonSession = {};
    const anonReq = { session: anonSession };
    const anonRes = { clearCookie: jest.fn(), redirect: jest.fn() };
    const anonNext = jest.fn();
    middleware(anonReq, anonRes, anonNext);
    expect(anonSession).toEqual({});
    expect(anonRes.clearCookie).not.toHaveBeenCalled();
    expect(anonNext).toHaveBeenCalledTimes(1);

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

    // Sesión expirada sobre /auth/logout: destruye, limpia cookie y redirige a /auth/login sin invocar next()
    const logoutSession = {
      sessionCreatedAt: t0,
      destroy: jest.fn((cb) => cb(null)),
    };
    const logoutReq = {
      user: { id: 42 },
      path: '/auth/logout',
      session: logoutSession,
    };
    const logoutRes = { clearCookie: jest.fn(), redirect: jest.fn() };
    const logoutNext = jest.fn();
    middleware(logoutReq, logoutRes, logoutNext);
    expect(logoutReq.user).toBeNull();
    expect(logoutSession.destroy).toHaveBeenCalledTimes(1);
    expect(logoutRes.clearCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      clearOpts,
    );
    expect(logoutRes.redirect).toHaveBeenCalledWith('/auth/login');
    expect(logoutNext).not.toHaveBeenCalled();
  });

  it('9. Sella sessionCreatedAt en login, mantiene válida la sesión < 7d y la destruye en PostgreSQL al superar 7d aunque maxAge se haya renovado (1.A5)', async () => {
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

      // Verifica que sessionCreatedAt se sella inmediatamente en POST /auth/login (antes de cualquier petición adicional)
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

      const firstDashboard = await agent.get('/dashboard');
      expect(firstDashboard.status).toBe(200);

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

  it('10. Maneja sin HTTP 500 sesiones > 7d en POST /auth/logout y POST /auth/login (inválido y válido) (1.A5)', async () => {
    const { User, sequelize } = db;
    const email = `abs_auth_routes_${Date.now()}@agrosystem.test`;
    const password = 'ValidPassword123';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name: 'Usuario Auth Expiracion',
      email,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    const expectClearedCookie = (res) => {
      const cleared = (res.headers['set-cookie'] || []).find((c) =>
        c.startsWith(`${SESSION_COOKIE_NAME}=;`),
      );
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Path=\//i);
      expect(cleared).toMatch(/HttpOnly/i);
      expect(cleared).toMatch(/SameSite=Lax/i);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
    };

    const createExpiredAgent = async () => {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/auth/login')
        .send({ email, password });
      expect(loginRes.status).toBe(302);

      const [[row]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(user.id) } },
      );
      expect(row).toBeDefined();
      expect(Number.isFinite(row.sess.sessionCreatedAt)).toBe(true);

      const expiredCreatedAt =
        Date.now() - (SESSION_ABSOLUTE_MAX_AGE_MS + 60_000);
      const renewedExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: row.sid,
            sess: JSON.stringify({
              ...row.sess,
              sessionCreatedAt: expiredCreatedAt,
              lastActive: new Date().toISOString(),
            }),
            expire: renewedExpire,
          },
        },
      );
      return { agent, sid: row.sid };
    };

    const countSessionsBySid = async (sid) => {
      const [rows] = await sequelize.query(
        'SELECT sid FROM "session" WHERE sid = :sid',
        { replacements: { sid } },
      );
      return rows.length;
    };

    const countSessionsByUser = async (uid) => {
      const [rows] = await sequelize.query(
        `SELECT sid FROM "session" WHERE (sess -> 'passport' ->> 'user') = :uid`,
        { replacements: { uid: String(uid) } },
      );
      return rows.length;
    };

    try {
      // A) POST /auth/logout y POST /AUTH/LOGOUT (case-insensitive) con sesión > 7d: 302 /auth/login sin 500, cookie limpiada y fila eliminada
      const logoutCase = await createExpiredAgent();
      const logoutRes = await logoutCase.agent.post('/auth/logout');
      expect(logoutRes.status).toBe(302);
      expect(logoutRes.headers.location).toBe('/auth/login');
      expectClearedCookie(logoutRes);
      expect(await countSessionsBySid(logoutCase.sid)).toBe(0);

      const upperLogoutCase = await createExpiredAgent();
      const upperLogoutRes = await upperLogoutCase.agent.post('/AUTH/LOGOUT');
      expect(upperLogoutRes.status).toBe(302);
      expect(upperLogoutRes.headers.location).toBe('/auth/login');
      expectClearedCookie(upperLogoutRes);
      expect(await countSessionsBySid(upperLogoutCase.sid)).toBe(0);

      // B) POST /auth/login con sesión > 7d y contraseña inválida: 401 sin 500, limpia cookie y no crea sesión nueva
      const badLoginCase = await createExpiredAgent();
      const badLoginRes = await badLoginCase.agent
        .post('/auth/login')
        .send({ email, password: 'WrongPassword123' });
      expect(badLoginRes.status).toBe(401);
      expectClearedCookie(badLoginRes);
      expect(await countSessionsBySid(badLoginCase.sid)).toBe(0);
      expect(await countSessionsByUser(user.id)).toBe(0);

      // C) POST /auth/login con sesión > 7d y credenciales válidas: 302 / sin 500, destruye vieja sesión y crea sesión nueva funcional
      const reloginCase = await createExpiredAgent();
      const reloginRes = await reloginCase.agent
        .post('/auth/login')
        .send({ email, password });
      expect(reloginRes.status).toBe(302);
      expect(reloginRes.headers.location).toBe('/');
      expect(await countSessionsBySid(reloginCase.sid)).toBe(0);

      const reloginCookies = reloginRes.headers['set-cookie'] || [];
      const freshCookie = reloginCookies.find(
        (c) =>
          c.startsWith(`${SESSION_COOKIE_NAME}=`) &&
          !c.startsWith(`${SESSION_COOKIE_NAME}=;`),
      );
      expect(freshCookie).toBeDefined();
      expect(freshCookie).toMatch(/HttpOnly/i);
      expect(freshCookie).toMatch(/SameSite=Lax/i);
      expect(
        reloginCookies.some((c) => c.startsWith(`${SESSION_COOKIE_NAME}=;`)),
      ).toBe(false);

      const [[freshRow]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(user.id) } },
      );
      expect(freshRow).toBeDefined();
      expect(freshRow.sid).not.toBe(reloginCase.sid);
      expect(Number.isFinite(freshRow.sess.sessionCreatedAt)).toBe(true);

      const postReloginDashboard = await reloginCase.agent.get('/dashboard');
      expect(postReloginDashboard.status).toBe(200);
    } finally {
      await sequelize.query(
        `DELETE FROM "session" WHERE (sess -> 'passport' ->> 'user') = :uid`,
        { replacements: { uid: String(user.id) } },
      );
      await user.destroy();
    }
  });

  it('11. Limpia sesiones > 7d sin regresiones en GET /, GET /private/profile y GET /api/notifications, y adopta sesiones previas sin sessionCreatedAt (1.A5)', async () => {
    const { User, sequelize } = db;
    const email = `abs_other_routes_${Date.now()}@agrosystem.test`;
    const password = 'ValidPassword123';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name: 'Usuario Rutas Publicas Privadas',
      email,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    const expectClearedCookie = (res) => {
      const cleared = (res.headers['set-cookie'] || []).find((c) =>
        c.startsWith(`${SESSION_COOKIE_NAME}=;`),
      );
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Path=\//i);
      expect(cleared).toMatch(/HttpOnly/i);
      expect(cleared).toMatch(/SameSite=Lax/i);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
    };

    const createExpiredAgent = async () => {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/auth/login')
        .send({ email, password });
      expect(loginRes.status).toBe(302);
      const [[row]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(user.id) } },
      );
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: row.sid,
            sess: JSON.stringify({
              ...row.sess,
              sessionCreatedAt:
                Date.now() - (SESSION_ABSOLUTE_MAX_AGE_MS + 60_000),
              lastActive: new Date().toISOString(),
            }),
            expire: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      );
      return { agent, sid: row.sid };
    };

    const countSessionsBySid = async (sid) => {
      const [rows] = await sequelize.query(
        'SELECT sid FROM "session" WHERE sid = :sid',
        { replacements: { sid } },
      );
      return rows.length;
    };

    try {
      const homeCase = await createExpiredAgent();
      const homeRes = await homeCase.agent.get('/');
      expect(homeRes.status).toBe(200);
      expectClearedCookie(homeRes);
      expect(
        (homeRes.headers['set-cookie'] || []).some(
          (c) =>
            c.startsWith(`${SESSION_COOKIE_NAME}=`) &&
            !c.startsWith(`${SESSION_COOKIE_NAME}=;`),
        ),
      ).toBe(false);
      expect(await countSessionsBySid(homeCase.sid)).toBe(0);
      const [homeUserSessions] = await sequelize.query(
        `SELECT sid FROM "session" WHERE (sess -> 'passport' ->> 'user') = :uid`,
        { replacements: { uid: String(user.id) } },
      );
      expect(homeUserSessions).toHaveLength(0);

      const profileCase = await createExpiredAgent();
      const profileRes = await profileCase.agent.get('/private/profile');
      expect(profileRes.status).toBe(302);
      expect(profileRes.headers.location).toBe('/auth/login');
      expectClearedCookie(profileRes);
      expect(await countSessionsBySid(profileCase.sid)).toBe(0);

      const notifCase = await createExpiredAgent();
      const notifRes = await notifCase.agent.get('/api/notifications');
      expect(notifRes.status).toBe(302);
      expect(notifRes.headers.location).toBe('/auth/login');
      expectClearedCookie(notifRes);
      expect(await countSessionsBySid(notifCase.sid)).toBe(0);

      // Sesión preexistente en BD sin sessionCreatedAt: se adopta y sella en la primera petición autenticada
      const legacyAgent = request.agent(app);
      await legacyAgent.post('/auth/login').send({ email, password });
      const [[legacyRow]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(user.id) } },
      );
      const { sessionCreatedAt: _omitted, ...sessWithoutCreatedAt } =
        legacyRow.sess;
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json WHERE sid = :sid',
        {
          replacements: {
            sid: legacyRow.sid,
            sess: JSON.stringify(sessWithoutCreatedAt),
          },
        },
      );

      const legacyRes = await legacyAgent.get('/dashboard');
      expect(legacyRes.status).toBe(200);
      const [[adoptedRow]] = await sequelize.query(
        'SELECT sess FROM "session" WHERE sid = :sid',
        { replacements: { sid: legacyRow.sid } },
      );
      expect(Number.isFinite(adoptedRow.sess.sessionCreatedAt)).toBe(true);
    } finally {
      await sequelize.query(
        `DELETE FROM "session" WHERE (sess -> 'passport' ->> 'user') = :uid`,
        { replacements: { uid: String(user.id) } },
      );
      await user.destroy();
    }
  });

  it('12. Reinicia sessionCreatedAt al re-autenticar otro usuario en POST /auth/login sobre sesión de 6d23h, pero no altera la sesión si el login falla (1.A5)', async () => {
    const { User, sequelize } = db;
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const password = 'ValidPassword123';
    const passwordHash = await bcrypt.hash(password, 10);
    const userA = await User.create({
      full_name: 'Usuario Sesion A',
      email: `relogin_a_${suffix}@agrosystem.test`,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });
    const userB = await User.create({
      full_name: 'Usuario Sesion B',
      email: `relogin_b_${suffix}@agrosystem.test`,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    const ageSessionTo6d23h = async (uid) => {
      const [[row]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(uid) } },
      );
      expect(row).toBeDefined();
      const agedCreatedAt =
        Date.now() - (SESSION_ABSOLUTE_MAX_AGE_MS - 60 * 60 * 1000);
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: row.sid,
            sess: JSON.stringify({
              ...row.sess,
              sessionCreatedAt: agedCreatedAt,
              lastActive: new Date().toISOString(),
            }),
            expire: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      );
      return { sid: row.sid, agedCreatedAt };
    };

    try {
      // 1) Fallo de POST /auth/login (contraseña incorrecta) sobre sesión 6d23h: 401 sin alterar usuario, sid ni sessionCreatedAt
      const failedAgent = request.agent(app);
      const loginA = await failedAgent
        .post('/auth/login')
        .send({ email: userA.email, password });
      expect(loginA.status).toBe(302);
      const agedA = await ageSessionTo6d23h(userA.id);

      const failedRelogin = await failedAgent
        .post('/auth/login')
        .send({ email: userB.email, password: 'WrongPassword123' });
      expect(failedRelogin.status).toBe(401);

      const [[rowAfterFailed]] = await sequelize.query(
        'SELECT sid, sess FROM "session" WHERE sid = :sid',
        { replacements: { sid: agedA.sid } },
      );
      expect(rowAfterFailed).toBeDefined();
      expect(rowAfterFailed.sess.passport.user).toBe(userA.id);
      expect(rowAfterFailed.sess.sessionCreatedAt).toBe(agedA.agedCreatedAt);

      const stillAuthA = await failedAgent.get('/dashboard');
      expect(stillAuthA.status).toBe(200);

      // 2) Re-login exitoso de otro usuario (POST /AUTH/LOGIN case-insensitive) sobre sesión 6d23h: reemplaza usuario y reinicia sessionCreatedAt a now
      const beforeReloginMs = Date.now();
      const okRelogin = await failedAgent
        .post('/AUTH/LOGIN')
        .send({ email: userB.email, password });
      expect(okRelogin.status).toBe(302);
      expect(okRelogin.headers.location).toBe('/');

      const [[rowUserB]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(userB.id) } },
      );
      expect(rowUserB).toBeDefined();
      expect(rowUserB.sid).not.toBe(agedA.sid);
      expect(rowUserB.sess.passport.user).toBe(userB.id);
      expect(rowUserB.sess.sessionCreatedAt).toBeGreaterThanOrEqual(
        beforeReloginMs - 1000,
      );
      expect(rowUserB.sess.sessionCreatedAt).toBeGreaterThan(
        agedA.agedCreatedAt + 6 * 24 * 60 * 60 * 1000,
      );
    } finally {
      await sequelize.query(
        `DELETE FROM "session" WHERE (sess -> 'passport' ->> 'user') IN (:uidA, :uidB)`,
        { replacements: { uidA: String(userA.id), uidB: String(userB.id) } },
      );
      await userA.destroy();
      await userB.destroy();
    }
  });

  it('13. Preserva sessionCreatedAt original de 6d23h tras POST /auth/inifap-upgrade sin extender el tope absoluto de 7 días (1.A5)', async () => {
    const { InifapCode, Notification, User, sequelize } = db;
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const password = 'ValidPassword123';
    const passwordHash = await bcrypt.hash(password, 10);
    const farmer = await User.create({
      full_name: 'Agricultor Upgrade Reloj',
      email: `upgrade_clock_${suffix}@agrosystem.test`,
      password_hash: passwordHash,
      role: 'agricultor',
      status: 'activo',
    });

    const rawCode = `AGS-1A5-${suffix.slice(-6).toUpperCase()}`;
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const codeRecord = await InifapCode.create({
      code: rawCode,
      code_hash: codeHash,
      code_masked: `AGS-1A5-****-${rawCode.slice(-4)}`,
      is_used: false,
    });

    try {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/auth/login')
        .send({ email: farmer.email, password });
      expect(loginRes.status).toBe(302);

      const [[initialRow]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(farmer.id) } },
      );
      expect(initialRow).toBeDefined();

      const agedCreatedAt =
        Date.now() - (SESSION_ABSOLUTE_MAX_AGE_MS - 60 * 60 * 1000);
      await sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: initialRow.sid,
            sess: JSON.stringify({
              ...initialRow.sess,
              sessionCreatedAt: agedCreatedAt,
              lastActive: new Date().toISOString(),
            }),
            expire: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      );

      const upgradeRes = await agent.post('/auth/inifap-upgrade').send({
        secret_code: rawCode,
        job_title: 'Investigador Fitosanitario',
      });
      expect(upgradeRes.status).toBe(302);
      expect(upgradeRes.headers.location).toBe('/dashboard');

      const [[upgradedRow]] = await sequelize.query(
        `SELECT sid, sess
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(farmer.id) } },
      );
      expect(upgradedRow).toBeDefined();
      expect(upgradedRow.sid).not.toBe(initialRow.sid);
      expect(upgradedRow.sess.sessionCreatedAt).toBe(agedCreatedAt);

      await farmer.reload();
      expect(farmer.role).toBe('inifap');
    } finally {
      await sequelize.query(
        `DELETE FROM "session" WHERE (sess -> 'passport' ->> 'user') = :uid`,
        { replacements: { uid: String(farmer.id) } },
      );
      if (Notification) {
        await Notification.destroy({ where: { actor_id: farmer.id } });
        await Notification.destroy({ where: { user_id: farmer.id } });
      }
      await codeRecord.destroy();
      await farmer.destroy();
    }
  });
});
