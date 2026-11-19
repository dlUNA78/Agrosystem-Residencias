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
import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import {
  authLimiter,
  createAuthRateLimiter,
  createRateLimiter,
  isRateLimitBypassed,
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

  it('cuenta solo intentos fallidos en POST /auth/login real: logins exitosos no acumulan cupo y 5 fallidos disparan 429 con Retry-After', async () => {
    // 7 logins exitosos seguidos con rateLimitTest=1 nunca disparan 429 ni dejan intentos acumulados
    for (let i = 0; i < 7; i += 1) {
      const okRes = await request(app)
        .post('/auth/login?rateLimitTest=1')
        .send({ email: LOGIN_TEST_EMAIL, password: LOGIN_TEST_PASSWORD });
      expect(okRes.status).toBe(302);
    }
    expect(authLimiter.getTrackedKeyCount()).toBe(0);

    // 5 intentos fallidos consecutivos -> 401
    for (let i = 0; i < 5; i += 1) {
      const failRes = await request(app)
        .post('/auth/login?rateLimitTest=1')
        .send({ email: LOGIN_TEST_EMAIL, password: 'WrongPassword!' });
      expect(failRes.status).toBe(401);
    }

    // 6to intento -> 429 con cabecera Retry-After válida y aviso al usuario
    const blockedRes = await request(app)
      .post('/auth/login?rateLimitTest=1')
      .send({ email: LOGIN_TEST_EMAIL, password: 'WrongPassword!' });
    expect(blockedRes.status).toBe(429);
    expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(blockedRes.text).toContain(
      'Demasiados intentos de inicio de sesión',
    );
  });

  it('tope por cuenta (25/15m) entrega 429 idéntico para correos existentes e inexistentes y notifica una sola vez por ventana solo si existe', async () => {
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

    // Esperar a que ejecute setImmediate para la notificación asíncrona
    await new Promise((resolve) => setImmediate(resolve));
    expect(notifiedEmails).toEqual([
      LOGIN_TEST_EMAIL,
      'no-existe-1a4@agrosystem.test',
    ]);

    // Verificar el notificador real contra PostgreSQL: solo crea notificación si el usuario existe
    const realAuth = createAuthRateLimiter({
      ipMaxRequests: 60,
      ipEmailMaxRequests: 5,
      accountMaxRequests: 25,
    });
    const nextReal = jest.fn();
    for (let i = 1; i <= 26; i += 1) {
      const r1 = createMockRes();
      realAuth(
        {
          ip: `192.0.2.${i}`,
          path: '/auth/login',
          body: { email: LOGIN_TEST_EMAIL },
          query: { rateLimitTest: '1' },
        },
        r1,
        nextReal,
      );
      const r2 = createMockRes();
      realAuth(
        {
          ip: `192.0.2.${100 + i}`,
          path: '/auth/login',
          body: { email: 'cuenta_inexistente@agrosystem.test' },
          query: { rateLimitTest: '1' },
        },
        r2,
        nextReal,
      );
    }

    // Dar margen a la consulta asíncrona de notificación en BD
    await new Promise((resolve) => setTimeout(resolve, 150));
    const securityNotifs = await Notification.findAll({
      where: {
        user_id: testUser.id,
        category: 'seguridad',
        title: 'Múltiples intentos fallidos de inicio de sesión',
      },
    });
    expect(securityNotifs).toHaveLength(1);
    expect(securityNotifs[0].action_url).toBe('/profile#tab-security');
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

  it('exige LOADTEST_MODE=true junto a DISABLE_RATE_LIMIT=true en production y docker-compose.loadtest.yml define ambas', () => {
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

    const composeContent = fs.readFileSync(
      path.resolve('docker-compose.loadtest.yml'),
      'utf8',
    );
    expect(composeContent).toContain('LOADTEST_MODE:');
    expect(composeContent).toContain('DISABLE_RATE_LIMIT:');
  });
});
