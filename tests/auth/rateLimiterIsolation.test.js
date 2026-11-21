import fs from 'node:fs';
import path from 'node:path';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import {
  AUTH_SECURITY_NOTIFICATION_TITLE,
  authLimiter,
  createAuthRateLimiter,
  createRateLimiter,
  isRateLimitBypassed,
  MAX_EMAIL_KEY_LENGTH,
  normalizeLoginEmail,
  publicRateLimiter,
  resetRateLimitWarningState,
  resolveAuthRateLimitKeys,
  shouldSkipPublicRateLimiter,
} from '../../src/middlewares/rateLimiter.js';

const { User, Notification } = db;
const LOGIN_TEST_EMAIL = 'ratelimit_login_1a4@agrosystem.test';
const LOGIN_TEST_PASSWORD = 'RateLimit@1A4Password';

const createMockRes = () => {
  const headers = {};
  return {
    headers,
    setHeader: jest.fn((k, v) => {
      headers[k.toLowerCase()] = String(v);
    }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };
};

describe('1.A4 Rate limiting en 3 capas, solo fallidos, Retry-After, tope duro y LOADTEST_MODE', () => {
  let testUser = null;

  beforeAll(async () => {
    const existing = await User.findOne({ where: { email: LOGIN_TEST_EMAIL } });
    if (existing) {
      await Notification.destroy({ where: { user_id: existing.id } });
      await existing.destroy();
    }
    const passwordHash = await bcrypt.hash(LOGIN_TEST_PASSWORD, 10);
    testUser = await User.create({
      full_name: 'Usuario RateLimit 1A4',
      email: LOGIN_TEST_EMAIL,
      password_hash: passwordHash,
      role: 'agricultor',
      status: 'activo',
    });
  });

  afterAll(async () => {
    if (testUser) {
      await Notification.destroy({ where: { user_id: testUser.id } });
      await testUser.destroy();
    }
    await closeAppResources();
  });

  beforeEach(() => {
    publicRateLimiter.reset();
    authLimiter.reset();
    resetRateLimitWarningState();
  });

  it('publicRateLimiter no consume cupo en /private, /dashboard, /profile, /auth, /api autenticada ni /api/notifications', async () => {
    const excludedRequests = [
      { path: '/private/lands', query: { rateLimitTest: '1' } },
      { path: '/private/crops', query: { rateLimitTest: '1' } },
      { path: '/dashboard', query: { rateLimitTest: '1' } },
      { path: '/profile', query: { rateLimitTest: '1' } },
      { path: '/auth/login', query: { rateLimitTest: '1' } },
      { path: '/api/notifications', query: { rateLimitTest: '1' } },
      { path: '/notifications/1/open', query: { rateLimitTest: '1' } },
      {
        path: '/api/crops',
        user: { id: 1, role: 'agricultor' },
        query: { rateLimitTest: '1' },
      },
      {
        path: '/api/plagues',
        isAuthenticated: () => true,
        query: { rateLimitTest: '1' },
      },
    ];

    for (const reqMock of excludedRequests) {
      expect(shouldSkipPublicRateLimiter(reqMock)).toBe(true);
    }

    const res = createMockRes();
    const next = jest.fn();

    for (const reqMock of excludedRequests) {
      for (let i = 0; i < 40; i += 1) {
        publicRateLimiter({ ...reqMock, ip: '203.0.113.77' }, res, next);
      }
    }

    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(publicRateLimiter.getTrackedKeyCount()).toBe(0);

    // Integración HTTP real: 35 llamadas a /api/notifications?rateLimitTest=1 nunca agotan cupo público
    for (let i = 0; i < 35; i += 1) {
      const notifRes = await request(app).get(
        '/api/notifications?rateLimitTest=1',
      );
      expect(notifRes.status).toBe(302);
    }
    expect(publicRateLimiter.getTrackedKeyCount()).toBe(0);
  });

  it('normaliza el correo (trim + minúsculas) antes de construir las claves de authLimiter', () => {
    expect(normalizeLoginEmail('  Admin.Test@INIFAP.gob.mx \t ')).toBe(
      'admin.test@inifap.gob.mx',
    );
    expect(
      resolveAuthRateLimitKeys({
        ip: '10.0.0.5',
        body: { email: '  UserA@Inifap.GOB.MX ' },
      }),
    ).toEqual({
      ipKey: '10.0.0.5',
      ipEmailKey: '10.0.0.5:usera@inifap.gob.mx',
      accountKey: 'acct:usera@inifap.gob.mx',
      normalizedEmail: 'usera@inifap.gob.mx',
    });

    // 5 intentos alternando mayúsculas y espacios comparten la misma cubeta y el 6to devuelve 429 + Retry-After
    const res = createMockRes();
    const next = jest.fn();
    const variants = [
      'usera@inifap.gob.mx',
      '  USERA@inifap.gob.mx',
      'UserA@INIFAP.GOB.MX  ',
      'usera@INIFAP.gob.mx',
      '  usera@inifap.gob.mx  ',
    ];
    for (const emailVariant of variants) {
      authLimiter(
        {
          ip: '10.0.0.5',
          path: '/auth/login',
          body: { email: emailVariant },
          query: { rateLimitTest: '1' },
        },
        res,
        next,
      );
    }
    expect(next).toHaveBeenCalledTimes(5);

    authLimiter(
      {
        ip: '10.0.0.5',
        path: '/auth/login',
        body: { email: 'USERA@inifap.gob.mx' },
        query: { rateLimitTest: '1' },
      },
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  it('evalúa primero la capa por IP (60/15m) para frenar password spraying sin inflar las capas de IP+correo ni cuenta', () => {
    const res = createMockRes();
    const next = jest.fn();
    const sprayIp = '198.51.100.99';

    // 60 correos distintos desde una misma IP (password spraying)
    for (let i = 1; i <= 60; i += 1) {
      authLimiter(
        {
          ip: sprayIp,
          path: '/auth/login',
          body: { email: `spray-${i}@agrosystem.test` },
          query: { rateLimitTest: '1' },
        },
        res,
        next,
      );
    }
    expect(next).toHaveBeenCalledTimes(60);
    const countsBeforeBlock = authLimiter.getLayerCounts();
    expect(countsBeforeBlock).toMatchObject({
      ip: 1,
      ipEmail: 60,
      account: 60,
    });

    // Peticiones 61..70 desde la misma IP bloqueada NO deben crear claves nuevas en ipEmail ni account
    for (let i = 61; i <= 70; i += 1) {
      const blockedRes = createMockRes();
      authLimiter(
        {
          ip: sprayIp,
          path: '/auth/login',
          body: { email: `spray-blocked-${i}@agrosystem.test` },
          query: { rateLimitTest: '1' },
        },
        blockedRes,
        next,
      );
      expect(blockedRes.status).toHaveBeenCalledWith(429);
      expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThanOrEqual(
        1,
      );
    }

    expect(authLimiter.getLayerCounts()).toEqual(countsBeforeBlock);
  });

  it('cuenta solo intentos fallidos por autenticación explícita (no por status < 400): 6 fallidos consecutivos reciben 429 incluso si el fallo responde 302 redirect', async () => {
    // A) Ruta real POST /auth/login: éxito devuelve 302 Location: / y no acumula intentos
    for (let i = 0; i < 7; i += 1) {
      const okRes = await request(app)
        .post('/auth/login?rateLimitTest=1')
        .type('form')
        .send({ email: LOGIN_TEST_EMAIL, password: LOGIN_TEST_PASSWORD });
      expect(okRes.status).toBe(302);
      expect(okRes.headers.location).toBe('/');
    }
    expect(authLimiter.getTrackedKeyCount()).toBe(0);

    // 5 intentos fallidos consecutivos en POST /auth/login real -> 401 sin Location
    for (let i = 0; i < 5; i += 1) {
      const failRes = await request(app)
        .post('/auth/login?rateLimitTest=1')
        .type('form')
        .send({ email: LOGIN_TEST_EMAIL, password: 'WrongPassword!' });
      expect(failRes.status).toBe(401);
      expect(failRes.headers.location).toBeUndefined();
    }

    // 6to intento -> 429 con cabecera Retry-After válida y aviso al usuario
    const blockedRes = await request(app)
      .post('/auth/login?rateLimitTest=1')
      .type('form')
      .send({ email: LOGIN_TEST_EMAIL, password: 'WrongPassword!' });
    expect(blockedRes.status).toBe(429);
    expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(blockedRes.text).toContain(
      'Demasiados intentos de inicio de sesión',
    );

    // B) Escenario de fallo con redirección 302 (patrón clásico de Passport failureRedirect):
    // 6 contraseñas incorrectas seguidas donde el fallo devuelve 302 -> /auth/login
    // demuestran que la 6ta SIEMPRE recibe 429 porque req.user / req.isAuthenticated() es falso.
    const redirectApp = express();
    const redirectAuthLimiter = createAuthRateLimiter({
      ipMaxRequests: 60,
      ipEmailMaxRequests: 5,
      accountMaxRequests: 25,
    });
    redirectApp.use(express.json());
    redirectApp.use(express.urlencoded({ extended: true }));
    redirectApp.post('/auth/login', redirectAuthLimiter, (req, res) => {
      if (req.body.password === 'CorrectPassword!') {
        req.user = { id: 1, email: req.body.email };
        req.isAuthenticated = () => true;
        res.locals.loginSucceeded = true;
        return res.redirect('/');
      }
      req.isAuthenticated = () => false;
      return res.redirect('/auth/login?error=invalid');
    });

    for (let i = 0; i < 5; i += 1) {
      const failedRedirect = await request(redirectApp)
        .post('/auth/login?rateLimitTest=1')
        .send({ email: 'redirect-fail@agrosystem.test', password: 'bad' });
      expect(failedRedirect.status).toBe(302);
      expect(failedRedirect.headers.location).toBe('/auth/login?error=invalid');
    }

    const sixthRedirectFail = await request(redirectApp)
      .post('/auth/login?rateLimitTest=1')
      .send({ email: 'redirect-fail@agrosystem.test', password: 'bad' });
    expect(sixthRedirectFail.status).toBe(429);
    expect(
      Number(sixthRedirectFail.headers['retry-after']),
    ).toBeGreaterThanOrEqual(1);
  });

  it('confirma que un bloqueo en cualquier capa no incrementa contadores de otras capas y maneja entradas no confiables (ausente, array, objeto, >254 chars)', async () => {
    // 1. Entradas no confiables en normalizeLoginEmail y resolveAuthRateLimitKeys
    expect(MAX_EMAIL_KEY_LENGTH).toBe(254);
    expect(normalizeLoginEmail(undefined)).toBe('');
    expect(normalizeLoginEmail(null)).toBe('');
    expect(normalizeLoginEmail(['a@test.com', 'b@test.com'])).toBe('');
    expect(normalizeLoginEmail({ $ne: '' })).toBe('');
    expect(normalizeLoginEmail(12345)).toBe('');

    const overlongEmail = `${'a'.repeat(500)}@agrosystem.test`;
    const normalizedLong = normalizeLoginEmail(
      `  ${overlongEmail.toUpperCase()}  `,
    );
    expect(normalizedLong).toHaveLength(254);
    expect(normalizedLong).toBe('a'.repeat(254));

    const untrustedReqArray = {
      ip: '198.51.100.40',
      body: { email: ['x@test.com'] },
      query: { rateLimitTest: '1' },
    };
    const untrustedReqObj = {
      ip: '198.51.100.40',
      body: { email: { $gt: '' } },
      query: { rateLimitTest: '1' },
    };
    expect(resolveAuthRateLimitKeys(untrustedReqArray)).toEqual({
      ipKey: '198.51.100.40',
      ipEmailKey: '198.51.100.40:__anonymous__',
      accountKey: null,
      normalizedEmail: '',
    });
    expect(resolveAuthRateLimitKeys(untrustedReqObj).accountKey).toBeNull();

    // Integración HTTP real: POST /auth/login con body JSON malformado (array/objeto/ausente/muy largo)
    // corre después de express.json() / express.urlencoded() sin lanzar 500
    for (const payload of [
      {},
      { email: ['a@b.com'], password: 'wrong' },
      { email: { $ne: '' }, password: 'wrong' },
      { email: overlongEmail, password: 'wrong' },
    ]) {
      const r = await request(app)
        .post('/auth/login?rateLimitTest=1')
        .send(payload);
      expect(r.status).toBe(401);
    }

    // 2. Verificar contadores exactos por capa: bloqueado no incrementa ninguna capa
    const layerLimiter = createAuthRateLimiter({
      ipMaxRequests: 10,
      ipEmailMaxRequests: 3,
      accountMaxRequests: 5,
    });
    const next = jest.fn();

    // Fallo sin correo: solo incrementa ip (+1) e ipEmail (+1), account queda en 0
    const reqNoEmail = {
      ip: '10.20.0.1',
      body: {},
      query: { rateLimitTest: '1' },
    };
    layerLimiter(reqNoEmail, createMockRes(), next);
    expect(layerLimiter.getLayerHitCountsForReq(reqNoEmail)).toEqual({
      ip: 1,
      ipEmail: 1,
      account: 0,
    });

    // 3 fallos con correo en otra IP llenan ipEmail (3/3)
    const reqWithEmail = {
      ip: '10.20.0.2',
      body: { email: 'capas@agrosystem.test' },
      query: { rateLimitTest: '1' },
    };
    for (let i = 0; i < 3; i += 1) {
      layerLimiter(reqWithEmail, createMockRes(), next);
    }
    expect(layerLimiter.getLayerHitCountsForReq(reqWithEmail)).toEqual({
      ip: 3,
      ipEmail: 3,
      account: 3,
    });

    // 4to intento bloqueado por capa 2 (ipEmail) NO debe incrementar ip ni account
    const blockedByLayer2 = createMockRes();
    layerLimiter(reqWithEmail, blockedByLayer2, next);
    expect(blockedByLayer2.status).toHaveBeenCalledWith(429);
    expect(layerLimiter.getLayerHitCountsForReq(reqWithEmail)).toEqual({
      ip: 3,
      ipEmail: 3,
      account: 3,
    });

    // 2 fallos más desde otra IP llevan account a 5/5
    const reqOtherIp = {
      ip: '10.20.0.3',
      body: { email: 'capas@agrosystem.test' },
      query: { rateLimitTest: '1' },
    };
    layerLimiter(reqOtherIp, createMockRes(), next);
    layerLimiter(reqOtherIp, createMockRes(), next);
    expect(layerLimiter.getLayerHitCountsForReq(reqOtherIp)).toEqual({
      ip: 2,
      ipEmail: 2,
      account: 5,
    });

    // Intento desde IP nueva bloqueado por capa 3 (account) NO debe incrementar ip ni ipEmail
    const reqThirdIp = {
      ip: '10.20.0.4',
      body: { email: 'capas@agrosystem.test' },
      query: { rateLimitTest: '1' },
    };
    const blockedByLayer3 = createMockRes();
    layerLimiter(reqThirdIp, blockedByLayer3, next);
    expect(blockedByLayer3.status).toHaveBeenCalledWith(429);
    expect(layerLimiter.getLayerHitCountsForReq(reqThirdIp)).toEqual({
      ip: 0,
      ipEmail: 0,
      account: 5,
    });
  });

  it('tope por cuenta (25/15m) entrega 429 idéntico para correos existentes e inexistentes, notifica una vez por ventana y no duplica si ya hay aviso sin leer', async () => {
    const notifiedEmails = [];
    const customAuth = createAuthRateLimiter({
      ipMaxRequests: 60,
      ipEmailMaxRequests: 5,
      accountMaxRequests: 25,
      onAccountThresholdReached: async (email) => {
        notifiedEmails.push(email);
      },
    });

    const triggerAccountThreshold = (email) => {
      const next = jest.fn();
      for (let i = 1; i <= 25; i += 1) {
        const res = createMockRes();
        customAuth(
          {
            ip: `203.0.113.${i}`,
            path: '/auth/login',
            body: { email },
            query: { rateLimitTest: '1' },
          },
          res,
          next,
        );
      }
      expect(next).toHaveBeenCalledTimes(25);

      const res26 = createMockRes();
      customAuth(
        {
          ip: '203.0.113.200',
          path: '/auth/login',
          body: { email },
          query: { rateLimitTest: '1' },
        },
        res26,
        next,
      );

      // Segundo bloqueo en la misma ventana no debe disparar segunda notificación
      const res27 = createMockRes();
      customAuth(
        {
          ip: '203.0.113.201',
          path: '/auth/login',
          body: { email },
          query: { rateLimitTest: '1' },
        },
        res27,
        next,
      );

      return { res26, res27 };
    };

    const existingOut = triggerAccountThreshold(LOGIN_TEST_EMAIL);
    const missingOut = triggerAccountThreshold('no-existe-1a4@agrosystem.test');

    // Respuestas 429 idénticas (sin oracle de enumeración de cuentas)
    expect(existingOut.res26.status).toHaveBeenCalledWith(429);
    expect(missingOut.res26.status).toHaveBeenCalledWith(429);
    expect(existingOut.res26.send.mock.calls[0][0]).toBe(
      missingOut.res26.send.mock.calls[0][0],
    );
    expect(
      Number(existingOut.res26.headers['retry-after']),
    ).toBeGreaterThanOrEqual(1);
    expect(
      Number(missingOut.res26.headers['retry-after']),
    ).toBeGreaterThanOrEqual(1);

    await new Promise((resolve) => setImmediate(resolve));
    expect(notifiedEmails).toEqual([
      LOGIN_TEST_EMAIL,
      'no-existe-1a4@agrosystem.test',
    ]);

    // Verificar el notificador real contra PostgreSQL:
    // 1) Solo crea notificación si el usuario existe.
    // 2) Incluso en una nueva ventana (realAuth.reset()), NO crea un segundo aviso mientras exista uno sin leer.
    await Notification.destroy({
      where: {
        user_id: testUser.id,
        category: 'seguridad',
        title: AUTH_SECURITY_NOTIFICATION_TITLE,
      },
    });
    const realAuth = createAuthRateLimiter({
      ipMaxRequests: 60,
      ipEmailMaxRequests: 5,
      accountMaxRequests: 25,
    });
    const triggerRealDbThreshold = async () => {
      const nextReal = jest.fn();
      for (let i = 1; i <= 26; i += 1) {
        realAuth(
          {
            ip: `192.0.2.${i}`,
            path: '/auth/login',
            body: { email: LOGIN_TEST_EMAIL },
            query: { rateLimitTest: '1' },
          },
          createMockRes(),
          nextReal,
        );
        realAuth(
          {
            ip: `192.0.2.${100 + i}`,
            path: '/auth/login',
            body: { email: 'cuenta_inexistente@agrosystem.test' },
            query: { rateLimitTest: '1' },
          },
          createMockRes(),
          nextReal,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    };

    await triggerRealDbThreshold();
    const afterFirstWindow = await Notification.findAll({
      where: {
        user_id: testUser.id,
        category: 'seguridad',
        title: AUTH_SECURITY_NOTIFICATION_TITLE,
      },
    });
    expect(afterFirstWindow).toHaveLength(1);
    expect(afterFirstWindow[0].is_read).toBe(false);
    expect(afterFirstWindow[0].action_url).toBe('/profile#tab-security');

    // Simular una nueva ventana (reset del limiter en memoria): como el aviso sigue sin leer, NO debe duplicarse
    realAuth.reset();
    await triggerRealDbThreshold();
    const afterSecondWindowWhileUnread = await Notification.findAll({
      where: {
        user_id: testUser.id,
        category: 'seguridad',
        title: AUTH_SECURITY_NOTIFICATION_TITLE,
      },
    });
    expect(afterSecondWindowWhileUnread).toHaveLength(1);
  });

  it('aplica tope duro de claves al Map en memoria y poda entradas expiradas', () => {
    const cappedLimiter = createRateLimiter(1000, 3, 'Límite excedido', {
      maxKeys: 3,
    });
    const next = jest.fn();

    for (let i = 1; i <= 5; i += 1) {
      const res = createMockRes();
      cappedLimiter(
        { ip: `192.0.2.${i}`, path: '/crops', query: { rateLimitTest: '1' } },
        res,
        next,
      );
      expect(cappedLimiter.getTrackedKeyCount()).toBeLessThanOrEqual(3);
    }

    cappedLimiter.prune(Date.now() + 1500);
    expect(cappedLimiter.getTrackedKeyCount()).toBe(0);
  });

  it('exige LOADTEST_MODE=true junto a DISABLE_RATE_LIMIT=true en production, .env.example solo los comenta y docker-compose.loadtest.yml los activa', () => {
    const ignoredLogger = { warn: jest.fn() };
    expect(
      isRateLimitBypassed(
        {},
        { NODE_ENV: 'production', DISABLE_RATE_LIMIT: 'true' },
        ignoredLogger,
      ),
    ).toBe(false);
    expect(ignoredLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('LOADTEST_MODE'),
    );

    const allowedLogger = { warn: jest.fn() };
    expect(
      isRateLimitBypassed(
        {},
        {
          NODE_ENV: 'production',
          DISABLE_RATE_LIMIT: 'true',
          LOADTEST_MODE: 'true',
        },
        allowedLogger,
      ),
    ).toBe(true);
    expect(allowedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('LOADTEST_MODE=true'),
    );

    const envExample = fs.readFileSync(path.resolve('.env.example'), 'utf8');
    expect(envExample).not.toMatch(/^\s*DISABLE_RATE_LIMIT=/m);
    expect(envExample).not.toMatch(/^\s*LOADTEST_MODE=/m);
    expect(envExample).toMatch(/^#\s*DISABLE_RATE_LIMIT=true/m);
    expect(envExample).toMatch(/^#\s*LOADTEST_MODE=true/m);

    const composeContent = fs.readFileSync(
      path.resolve('docker-compose.loadtest.yml'),
      'utf8',
    );
    expect(composeContent).toContain('LOADTEST_MODE:');
    expect(composeContent).toContain('DISABLE_RATE_LIMIT:');
  });
});
