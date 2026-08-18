const requestCounts = new Map();
const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 30; // 30 peticiones por minuto

export const publicRateLimiter = (req, res, next) => {
  // En entorno de prueba (Jest), aplicar rate limit cuando req.query.rateLimitTest === '1' o cuando no se marque bypass
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
    .filter((time) => now - time < WINDOW_MS);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message:
        'Ha superado el límite de peticiones permitidas. Por favor espere un momento.',
    });
  }

  next();
};
