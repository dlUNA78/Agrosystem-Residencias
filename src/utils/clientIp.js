/**
 * Extrae la IP del cliente respetando la configuración `trust proxy` de Express (1.A1 / 1.A4 / 1.A6).
 *
 * - En peticiones reales de Express, `req.ip` siempre está definido:
 *   - Si `TRUST_PROXY` no está activo, Express devuelve `req.socket.remoteAddress` e ignora `X-Forwarded-For`.
 *   - Si `TRUST_PROXY` está activo (p. ej. `TRUST_PROXY=1`), Express resuelve la IP confiable desde `X-Forwarded-For`.
 * - El respaldo a `x-forwarded-for` solo se usa cuando se invocan middlewares/servicios en pruebas unitarias
 *   con objetos `req` sintéticos sin `req.ip`.
 */
const normalizeNonEmptyIp = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const extractFirstForwardedIp = (headers) => {
  const forwarded = normalizeNonEmptyIp(headers?.['x-forwarded-for']);
  return forwarded ? forwarded.split(',')[0].trim() : null;
};

export const extractClientIp = (req) =>
  normalizeNonEmptyIp(req?.ip) ||
  extractFirstForwardedIp(req?.headers) ||
  req?.socket?.remoteAddress ||
  '127.0.0.1';
