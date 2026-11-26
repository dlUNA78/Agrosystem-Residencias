import db from '../models/index.js';
import { extractClientIp } from '../utils/clientIp.js';

/**
 * Intervalo mínimo entre escrituras de actividad de sesión (`lastActive` y renovación de `expire` en BD).
 *
 * Nota operativa (1.A6):
 * - Con `resave: false`, `rolling: false` y `disableTouch: true` en `PgSession`, las peticiones autenticadas
 *   que ocurren dentro de esta ventana sin cambiar IP ni User-Agent no mutan `req.session` y generan
 *   0 escrituras en `"session"`.
 * - En consecuencia, tanto "última actividad" (`lastActive`) como la expiración en BD (`expire`) y el
 *   `Max-Age`/`Expires` de la cookie se renuevan juntos con una granularidad máxima de 5 minutos (puede
 *   existir hasta 5 minutos de retraso en `lastActive`).
 */
export const SESSION_ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;
export const PROFILE_DISPLAYED_SESSIONS_LIMIT = 20;

const formatSessionTimestamp = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const parseDeviceOs = (ua) => {
  if (/windows/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/macintosh|mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Sistema operativo desconocido';
};

const parseBrowserName = (ua) => {
  if (/edg/i.test(ua)) return 'Microsoft Edge';
  if (/chrome|crios/i.test(ua)) return 'Google Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Mozilla Firefox';
  if (
    (/safari/i.test(ua) || /iphone|ipad|ipod/i.test(ua)) &&
    !/chrome/i.test(ua)
  ) {
    return 'Apple Safari';
  }
  if (/curl|postman|supertest/i.test(ua)) return 'Cliente API / Prueba';
  return 'Navegador Web';
};

export const formatUserAgentSummary = (ua) => {
  if (!ua || typeof ua !== 'string') return 'Navegador Web';
  const browser = parseBrowserName(ua);
  const os = parseDeviceOs(ua);
  return `${browser} (${os})`;
};

const safeParseJson = (data) => {
  if (!data) return null;
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (_e) {
    return null;
  }
};

const extractSessionUser = (sess) => {
  const parsed = safeParseJson(sess);
  return parsed?.passport?.user ?? null;
};

const mapSessionRow = (row, normalizedUserId, currentSessionId) => {
  const sessionUserId = extractSessionUser(row.sess);
  if (sessionUserId === null || String(sessionUserId) !== normalizedUserId) {
    return null;
  }
  const parsedSess = safeParseJson(row.sess) || {};
  const userAgent = parsedSess.userAgent || 'Navegador Web';
  const lastActive = parsedSess.lastActive || row.expire;
  return {
    sid: row.sid,
    isCurrent: Boolean(currentSessionId && row.sid === currentSessionId),
    expire: row.expire,
    expireFormatted: formatSessionTimestamp(row.expire),
    clientIp: parsedSess.clientIp || '127.0.0.1',
    userAgent,
    deviceSummary: formatUserAgentSummary(userAgent),
    // Nota: `lastActive` puede tener hasta 5 minutos de retraso por el throttling de escritura (SESSION_ACTIVITY_THROTTLE_MS).
    lastActive,
    lastActiveFormatted: formatSessionTimestamp(lastActive),
  };
};

const mapUserSessionRows = (rows, normalizedUserId, currentSessionId) => {
  const userSessions = [];
  for (const row of rows) {
    const sessionObj = mapSessionRow(row, normalizedUserId, currentSessionId);
    if (sessionObj) {
      userSessions.push(sessionObj);
    }
  }
  return userSessions;
};

export const listUserActiveSessions = async (
  userId,
  currentSessionId = null,
) => {
  if (!userId) return [];
  const normalizedUserId = String(userId);

  const [rows] = await db.sequelize.query(
    `SELECT sid, sess, expire
     FROM "session"
     WHERE (sess -> 'passport' ->> 'user') = :userId
       AND expire > NOW()
     ORDER BY expire DESC`,
    {
      replacements: { userId: normalizedUserId },
    },
  );

  return mapUserSessionRows(rows, normalizedUserId, currentSessionId);
};

const normalizeSessionDisplayLimit = (limit) => {
  const parsed = Number(limit);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : PROFILE_DISPLAYED_SESSIONS_LIMIT;
};

const fetchBoundedActiveSessionRows = async (
  normalizedUserId,
  currentSessionId,
  safeLimit,
) => {
  const hasCurrentSid =
    typeof currentSessionId === 'string' && currentSessionId.length > 0;

  if (!hasCurrentSid) {
    const [rows] = await db.sequelize.query(
      `SELECT sid, sess, expire
       FROM "session"
       WHERE (sess -> 'passport' ->> 'user') = :userId
         AND expire > NOW()
       ORDER BY expire DESC
       LIMIT :limit`,
      { replacements: { userId: normalizedUserId, limit: safeLimit } },
    );
    return rows;
  }

  // Incluye siempre la sesión actual (aunque no esté entre las `limit` más recientes)
  // y completa con las demás sesiones más recientes hasta un máximo exacto de `limit`.
  const [rows] = await db.sequelize.query(
    `SELECT sid, sess, expire
     FROM (
       (
         SELECT sid, sess, expire
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :userId
           AND expire > NOW()
           AND sid = :currentSessionId
         LIMIT 1
       )
       UNION ALL
       (
         SELECT sid, sess, expire
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :userId
           AND expire > NOW()
           AND sid <> :currentSessionId
         ORDER BY expire DESC
         LIMIT :limit
       )
     ) AS active_subset
     ORDER BY (sid = :currentSessionId) DESC, expire DESC
     LIMIT :limit`,
    {
      replacements: {
        userId: normalizedUserId,
        currentSessionId,
        limit: safeLimit,
      },
    },
  );
  return rows;
};

export const listUserActiveSessionsSummary = async (
  userId,
  currentSessionId = null,
  { limit = PROFILE_DISPLAYED_SESSIONS_LIMIT } = {},
) => {
  if (!userId) {
    return {
      activeSessions: [],
      sessionCount: 0,
      displayedSessionCount: 0,
      hasMoreSessions: false,
    };
  }

  const normalizedUserId = String(userId);
  const safeLimit = normalizeSessionDisplayLimit(limit);

  const [[countRows], boundedRows] = await Promise.all([
    db.sequelize.query(
      `SELECT COUNT(*)::int AS total
       FROM "session"
       WHERE (sess -> 'passport' ->> 'user') = :userId
         AND expire > NOW()`,
      { replacements: { userId: normalizedUserId } },
    ),
    fetchBoundedActiveSessionRows(
      normalizedUserId,
      currentSessionId,
      safeLimit,
    ),
  ]);

  const activeSessions = mapUserSessionRows(
    boundedRows,
    normalizedUserId,
    currentSessionId,
  );
  const sessionCount = Math.max(
    Number(countRows?.[0]?.total) || 0,
    activeSessions.length,
  );
  const displayedSessionCount = activeSessions.length;

  return {
    activeSessions,
    sessionCount,
    displayedSessionCount,
    hasMoreSessions: sessionCount > displayedSessionCount,
  };
};

export const revokeOtherSessions = async (userId, currentSessionId) => {
  if (!userId) return { revokedCount: 0 };
  const normalizedUserId = String(userId);

  const hasCurrentSid =
    typeof currentSessionId === 'string' && currentSessionId.length > 0;
  const sql = hasCurrentSid
    ? `DELETE FROM "session"
       WHERE (sess -> 'passport' ->> 'user') = :userId
         AND expire > NOW()
         AND sid <> :currentSessionId
       RETURNING sid`
    : `DELETE FROM "session"
       WHERE (sess -> 'passport' ->> 'user') = :userId
         AND expire > NOW()
       RETURNING sid`;

  const replacements = hasCurrentSid
    ? { userId: normalizedUserId, currentSessionId }
    : { userId: normalizedUserId };

  const [deletedRows] = await db.sequelize.query(sql, { replacements });
  const rows = Array.isArray(deletedRows) ? deletedRows : [];

  return { revokedCount: rows.length, details: rows };
};

export const revokeAllUserSessions = async (userId) => {
  if (!userId) return { revokedCount: 0 };
  const normalizedUserId = String(userId);

  const [deletedRows] = await db.sequelize.query(
    `DELETE FROM "session"
     WHERE (sess -> 'passport' ->> 'user') = :userId
       AND expire > NOW()
     RETURNING sid`,
    {
      replacements: { userId: normalizedUserId },
    },
  );
  const rows = Array.isArray(deletedRows) ? deletedRows : [];

  return { revokedCount: rows.length, details: rows };
};

const isWithinActivityThrottleWindow = (
  session,
  { clientIp, userAgent, now, throttleMs },
) => {
  if (session.clientIp !== clientIp || session.userAgent !== userAgent) {
    return false;
  }
  const lastActiveMs = session.lastActive
    ? Date.parse(session.lastActive)
    : Number.NaN;
  return (
    Number.isFinite(lastActiveMs) &&
    now >= lastActiveMs &&
    now - lastActiveMs < throttleMs
  );
};

const resolveRequestUserAgent = (req) =>
  req.headers?.['user-agent'] || 'Navegador Web';

export const enrichSessionActivity = (req, options = {}) => {
  if (!req || !req.session || !req.user) return false;
  const now = options.now ?? Date.now();
  const throttleMs = options.throttleMs ?? SESSION_ACTIVITY_THROTTLE_MS;
  const clientIp = extractClientIp(req);
  const userAgent = resolveRequestUserAgent(req);

  if (
    isWithinActivityThrottleWindow(req.session, {
      clientIp,
      userAgent,
      now,
      throttleMs,
    })
  ) {
    return false;
  }

  req.session.clientIp = clientIp;
  req.session.userAgent = userAgent;
  req.session.lastActive = new Date(now).toISOString();
  return true;
};
