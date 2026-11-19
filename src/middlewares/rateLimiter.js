const NON_PUBLIC_PATH_PREFIXES = Object.freeze([
  '/private',
  '/dashboard',
  '/profile',
  '/auth',
  '/api/notifications',
  '/notifications',
  '/suggestions',
]);

const DEFAULT_MAX_KEYS = 10000;
const AUTH_LIMIT_ERROR_MESSAGE =
  'Demasiados intentos de inicio de sesión. Por razones de seguridad, espera unos minutos antes de reintentar; si no reconoces esta actividad, cambia tu contraseña desde tu perfil.';

let productionBypassWarned = false;
let productionIgnoredWarned = false;

export const resetRateLimitWarningState = () => {
  productionBypassWarned = false;
  productionIgnoredWarned = false;
};

const parsePositiveInt = (raw, fallback) => {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const warnOnce = (flagName, logger, message) => {
  if (flagName === 'bypass') {
    if (productionBypassWarned) return;
    productionBypassWarned = true;
  } else {
    if (productionIgnoredWarned) return;
    productionIgnoredWarned = true;
  }
  logger.warn(message);
};

export const isRateLimitBypassed = (
  req,
  env = process.env,
  logger = console,
) => {
  if (req?.query?.rateLimitTest === '1') {
    return false;
  }

  if (env.NODE_ENV === 'test') {
    return true;
  }

  if (env.DISABLE_RATE_LIMIT !== 'true') {
    return false;
  }

  if (env.NODE_ENV !== 'production') {
    return true;
  }

  if (env.LOADTEST_MODE === 'true') {
    warnOnce(
      'bypass',
      logger,
      '⚠️ [MODO CARGA CONTROLADA] DISABLE_RATE_LIMIT=true y LOADTEST_MODE=true activos en NODE_ENV=production. Los limitadores de tasa están desactivados.',
    );
    return true;
  }

  warnOnce(
    'ignored',
    logger,
    '⚠️ [SEGURIDAD/RATE-LIMIT] DISABLE_RATE_LIMIT=true ignorado en NODE_ENV=production porque LOADTEST_MODE no es "true".',
  );
  return false;
};

const isAuthenticatedRequest = (req) =>
  Boolean(req?.user) ||
  (typeof req?.isAuthenticated === 'function' && req.isAuthenticated());

export const shouldSkipPublicRateLimiter = (req) => {
  const reqPath = String(req?.path || req?.originalUrl || '');
  if (
    NON_PUBLIC_PATH_PREFIXES.some(
      (prefix) => reqPath === prefix || reqPath.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  return reqPath.startsWith('/api/') && isAuthenticatedRequest(req);
};

const extractClientIp = (req) =>
  req?.ip ||
  req?.headers?.['x-forwarded-for'] ||
  req?.socket?.remoteAddress ||
  '127.0.0.1';

export const normalizeLoginEmail = (rawEmail) =>
  String(rawEmail || '')
    .trim()
    .toLowerCase();

export const resolveAuthRateLimitKeys = (req) => {
  const ip = extractClientIp(req);
  const email = normalizeLoginEmail(req?.body?.email);
  return {
    ipKey: ip,
    ipEmailKey: email ? `${ip}:${email}` : `${ip}:__anonymous__`,
    accountKey: email ? `acct:${email}` : null,
    normalizedEmail: email,
  };
};

const isJsonLikeRequest = (req) =>
  Boolean(
    req?.xhr ||
    req?.path?.startsWith('/api/') ||
    req?.headers?.accept?.includes('application/json'),
  );

const applyRetryAfterHeader = (res, retryAfterSeconds) => {
  const value = String(Math.max(1, Math.ceil(retryAfterSeconds)));
  if (typeof res?.setHeader === 'function') {
    res.setHeader('Retry-After', value);
  } else if (typeof res?.set === 'function') {
    res.set('Retry-After', value);
  }
};

const sendRateLimitExceeded = (req, res, errorMessage, retryAfterSeconds) => {
  applyRetryAfterHeader(res, retryAfterSeconds);
  if (isJsonLikeRequest(req)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: errorMessage,
    });
  }
  return res.status(429).send(errorMessage);
};

export const pruneExpiredRateLimitEntries = (
  store,
  windowMs,
  now = Date.now(),
) => {
  for (const [key, timestamps] of store.entries()) {
    const active = timestamps.filter((time) => now - time < windowMs);
    if (active.length === 0) {
      store.delete(key);
    } else if (active.length !== timestamps.length) {
      store.set(key, active);
    }
  }
};

const pruneTimestampMap = (store, windowMs, now = Date.now()) => {
  for (const [key, ts] of store.entries()) {
    if (now - ts >= windowMs) {
      store.delete(key);
    }
  }
};

const enforceMapHardCap = (store, windowMs, now, maxKeys, incomingKey) => {
  if (store.has(incomingKey) || store.size < maxKeys) {
    return;
  }
  pruneExpiredRateLimitEntries(store, windowMs, now);
  while (store.size >= maxKeys) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }
};

const getActiveTimestamps = (store, key, windowMs, now) => {
  const existing = store.get(key);
  if (!existing) return [];
  const active = existing.filter((time) => now - time < windowMs);
  if (active.length === 0) {
    store.delete(key);
  } else if (active.length !== existing.length) {
    store.set(key, active);
  }
  return active;
};

const computeRetryAfterSeconds = (activeTimestamps, windowMs, now) => {
  const oldest = activeTimestamps[0] ?? now;
  const remainingMs = Math.max(1000, windowMs - (now - oldest));
  return Math.ceil(remainingMs / 1000);
};

const checkLimitWithoutMutating = (store, key, windowMs, now, maxRequests) => {
  const active = getActiveTimestamps(store, key, windowMs, now);
  if (active.length >= maxRequests) {
    return {
      blocked: true,
      retryAfterSeconds: computeRetryAfterSeconds(active, windowMs, now),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
};

const appendHitToStore = (store, key, windowMs, now, maxKeys) => {
  enforceMapHardCap(store, windowMs, now, maxKeys, key);
  const active = getActiveTimestamps(store, key, windowMs, now);
  active.push(now);
  store.set(key, active);
  return active.length;
};

const rollbackHitFromStore = (store, key, recordedTimestamp) => {
  const existing = store.get(key);
  if (!existing || existing.length === 0) return;
  const idx = existing.lastIndexOf(recordedTimestamp);
  if (idx !== -1) {
    existing.splice(idx, 1);
  }
  if (existing.length === 0) {
    store.delete(key);
  } else {
    store.set(key, existing);
  }
};

const schedulePeriodicPrune = (fn, intervalMs) => {
  const timer = setInterval(fn, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
  return timer;
};

const defaultNotifyExistingAccountThreshold = async (normalizedEmail) => {
  if (!normalizedEmail) return;
  const [{ default: db }, { createNotification }] = await Promise.all([
    import('../models/index.js'),
    import('../services/notificationService.js'),
  ]);
  const UserModel = db?.User;
  if (!UserModel || typeof UserModel.findOne !== 'function') return;

  const user = await UserModel.findOne({
    where: { email: normalizedEmail },
    attributes: ['id', 'role'],
  });
  if (!user) return;

  await createNotification({
    userId: user.id,
    category: 'seguridad',
    severity: 'warning',
    title: 'Múltiples intentos fallidos de inicio de sesión',
    message:
      'Detectamos múltiples intentos fallidos recientes en tu cuenta. Si no reconoces esta actividad, cambia tu contraseña desde tu perfil.',
    actionUrl:
      user.role === 'agricultor'
        ? '/profile#tab-security'
        : '/private/profile#tab-security',
  });
};

export const createRateLimiter = (
  windowMs,
  maxRequests,
  errorMessage,
  options = {},
) => {
  const requestCounts = new Map();
  const skipFn = options.skip || null;
  const maxKeys = parsePositiveInt(
    options.maxKeys ?? process.env.RATE_LIMIT_MAX_KEYS,
    DEFAULT_MAX_KEYS,
  );
  const cleanupIntervalMs =
    options.cleanupIntervalMs || Math.min(windowMs, 60000);

  schedulePeriodicPrune(
    () => pruneExpiredRateLimitEntries(requestCounts, windowMs),
    cleanupIntervalMs,
  );

  const middleware = (req, res, next) => {
    if (typeof skipFn === 'function' && skipFn(req)) {
      return next();
    }

    if (isRateLimitBypassed(req)) {
      return next();
    }

    const now = Date.now();
    const ip = extractClientIp(req);
    const check = checkLimitWithoutMutating(
      requestCounts,
      ip,
      windowMs,
      now,
      maxRequests,
    );
    if (check.blocked) {
      return sendRateLimitExceeded(
        req,
        res,
        errorMessage,
        check.retryAfterSeconds,
      );
    }

    appendHitToStore(requestCounts, ip, windowMs, now, maxKeys);
    return next();
  };

  middleware.prune = (now = Date.now()) =>
    pruneExpiredRateLimitEntries(requestCounts, windowMs, now);
  middleware.reset = () => requestCounts.clear();
  middleware.getTrackedKeyCount = () => requestCounts.size;

  return middleware;
};

const evaluateAuthLayers = (stores, keys, windowMs, now, limits) => {
  // 1) Capa por IP primero: frena password spraying sin crear claves en las demás capas
  const ipCheck = checkLimitWithoutMutating(
    stores.ip,
    keys.ipKey,
    windowMs,
    now,
    limits.ipMax,
  );
  if (ipCheck.blocked) {
    return {
      blocked: true,
      layer: 'ip',
      retryAfterSeconds: ipCheck.retryAfterSeconds,
    };
  }

  // 2) Capa por IP + correo: no bloquea otros usuarios detrás de un NAT
  const ipEmailCheck = checkLimitWithoutMutating(
    stores.ipEmail,
    keys.ipEmailKey,
    windowMs,
    now,
    limits.ipEmailMax,
  );
  if (ipEmailCheck.blocked) {
    return {
      blocked: true,
      layer: 'ipEmail',
      retryAfterSeconds: ipEmailCheck.retryAfterSeconds,
    };
  }

  // 3) Capa por cuenta (solo si hay correo): umbral alto para evitar DoS trivial
  if (keys.accountKey) {
    const accountCheck = checkLimitWithoutMutating(
      stores.account,
      keys.accountKey,
      windowMs,
      now,
      limits.accountMax,
    );
    if (accountCheck.blocked) {
      return {
        blocked: true,
        layer: 'account',
        retryAfterSeconds: accountCheck.retryAfterSeconds,
      };
    }
  }

  return { blocked: false, layer: null, retryAfterSeconds: 0 };
};

const attachAuthSuccessRollback = (res, stores, keys, recordedAt) => {
  if (typeof res?.on !== 'function') {
    return;
  }
  res.on('finish', () => {
    if (res.statusCode > 0 && res.statusCode < 400) {
      rollbackHitFromStore(stores.ip, keys.ipKey, recordedAt);
      rollbackHitFromStore(stores.ipEmail, keys.ipEmailKey, recordedAt);
      if (keys.accountKey) {
        rollbackHitFromStore(stores.account, keys.accountKey, recordedAt);
      }
    }
  });
};

const triggerAccountSecurityNoticeOnce = (
  notifiedAccounts,
  email,
  windowMs,
  now,
  maxKeys,
  notifyFn,
) => {
  if (!email) return;
  const lastNotified = notifiedAccounts.get(email);
  if (lastNotified && now - lastNotified < windowMs) {
    return;
  }
  if (notifiedAccounts.size >= maxKeys) {
    pruneTimestampMap(notifiedAccounts, windowMs, now);
    while (notifiedAccounts.size >= maxKeys) {
      notifiedAccounts.delete(notifiedAccounts.keys().next().value);
    }
  }
  notifiedAccounts.set(email, now);
  setImmediate(() => {
    Promise.resolve(notifyFn(email)).catch(() => {});
  });
};

export const createAuthRateLimiter = (options = {}) => {
  const windowMs = parsePositiveInt(
    options.windowMs ?? process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
  );
  const limits = {
    ipMax: parsePositiveInt(
      options.ipMaxRequests ?? process.env.AUTH_IP_RATE_LIMIT_MAX,
      60,
    ),
    ipEmailMax: parsePositiveInt(
      options.ipEmailMaxRequests ?? process.env.AUTH_RATE_LIMIT_MAX,
      5,
    ),
    accountMax: parsePositiveInt(
      options.accountMaxRequests ?? process.env.AUTH_ACCOUNT_RATE_LIMIT_MAX,
      25,
    ),
  };
  const maxKeys = parsePositiveInt(
    options.maxKeys ?? process.env.RATE_LIMIT_MAX_KEYS,
    DEFAULT_MAX_KEYS,
  );
  const errorMessage = options.errorMessage || AUTH_LIMIT_ERROR_MESSAGE;
  const notifyFn =
    options.onAccountThresholdReached || defaultNotifyExistingAccountThreshold;

  const stores = {
    ip: new Map(),
    ipEmail: new Map(),
    account: new Map(),
  };
  const notifiedAccounts = new Map();

  const pruneAll = (now = Date.now()) => {
    pruneExpiredRateLimitEntries(stores.ip, windowMs, now);
    pruneExpiredRateLimitEntries(stores.ipEmail, windowMs, now);
    pruneExpiredRateLimitEntries(stores.account, windowMs, now);
    pruneTimestampMap(notifiedAccounts, windowMs, now);
  };

  schedulePeriodicPrune(
    () => pruneAll(),
    options.cleanupIntervalMs || Math.min(windowMs, 60000),
  );

  const middleware = (req, res, next) => {
    if (isRateLimitBypassed(req)) {
      return next();
    }

    const now = Date.now();
    const keys = resolveAuthRateLimitKeys(req);
    const verdict = evaluateAuthLayers(stores, keys, windowMs, now, limits);

    if (verdict.blocked) {
      if (verdict.layer === 'account') {
        triggerAccountSecurityNoticeOnce(
          notifiedAccounts,
          keys.normalizedEmail,
          windowMs,
          now,
          maxKeys,
          notifyFn,
        );
      }
      return sendRateLimitExceeded(
        req,
        res,
        errorMessage,
        verdict.retryAfterSeconds,
      );
    }

    appendHitToStore(stores.ip, keys.ipKey, windowMs, now, maxKeys);
    appendHitToStore(stores.ipEmail, keys.ipEmailKey, windowMs, now, maxKeys);
    if (keys.accountKey) {
      appendHitToStore(stores.account, keys.accountKey, windowMs, now, maxKeys);
    }
    attachAuthSuccessRollback(res, stores, keys, now);

    return next();
  };

  middleware.prune = pruneAll;
  middleware.reset = () => {
    stores.ip.clear();
    stores.ipEmail.clear();
    stores.account.clear();
    notifiedAccounts.clear();
  };
  middleware.getTrackedKeyCount = () =>
    stores.ip.size + stores.ipEmail.size + stores.account.size;
  middleware.getLayerCounts = () => ({
    ip: stores.ip.size,
    ipEmail: stores.ipEmail.size,
    account: stores.account.size,
    notifiedAccounts: notifiedAccounts.size,
  });

  return middleware;
};

// Rate limiter para rutas públicas (parametrizable por entorno, default 30 req / 60s)
export const publicRateLimiter = createRateLimiter(
  parsePositiveInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  parsePositiveInt(process.env.PUBLIC_RATE_LIMIT_MAX, 30),
  'Ha superado el límite de peticiones permitidas. Por favor espere un momento.',
  { skip: shouldSkipPublicRateLimiter },
);

// Rate limiter para Login: IP (60), IP+correo (5) y cuenta (25) / 15 min, solo fallidos
export const authLimiter = createAuthRateLimiter();

// Rate limiter para Ascenso de Cuenta / Upgrade (default 3 intentos / 10 min)
export const upgradeLimiter = createRateLimiter(
  parsePositiveInt(process.env.UPGRADE_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
  parsePositiveInt(process.env.UPGRADE_RATE_LIMIT_MAX, 3),
  'Demasiados intentos de canje de código INIFAP. Por favor espere 10 minutos antes de reintentar.',
);
