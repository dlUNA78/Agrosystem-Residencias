const createRateLimiter = (windowMs, maxRequests, errorMessage) => {
  const requestCounts = new Map();

  return (req, res, next) => {
    // En entorno de prueba (Jest), aplicar rate limit únicamente si req.query.rateLimitTest === '1'
    if (process.env.NODE_ENV === 'test' && req.query.rateLimitTest !== '1') {
      return next();
    }

    const ip =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const timestamps = requestCounts
      .get(ip)
      .filter((time) => now - time < windowMs);
    timestamps.push(now);
    requestCounts.set(ip, timestamps);

    if (timestamps.length > maxRequests) {
      const isJsonRequest =
        req.xhr ||
        req.path?.startsWith('/api/') ||
        req.headers?.accept?.includes('application/json');

      if (isJsonRequest) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: errorMessage,
        });
      }

      return res.status(429).send(errorMessage);
    }

    next();
  };
};

// Rate limiter para API pública general (30 peticiones/minuto)
export const publicRateLimiter = createRateLimiter(
  60 * 1000,
  30,
  'Ha superado el límite de peticiones permitidas. Por favor espere un momento.',
);

// Rate limiter para Login (5 intentos/15 minutos)
export const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  'Demasiados intentos de inicio de sesión. Por favor intente más tarde por razones de seguridad.',
);

// Rate limiter para Ascenso de Cuenta / Upgrade (3 intentos/10 minutos)
export const upgradeLimiter = createRateLimiter(
  10 * 60 * 1000,
  3,
  'Demasiados intentos de canje de código INIFAP. Por favor espere 10 minutos antes de reintentar.',
);
