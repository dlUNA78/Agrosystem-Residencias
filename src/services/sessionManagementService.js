import db from '../models/index.js';

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
  return {
    sid: row.sid,
    isCurrent: Boolean(currentSessionId && row.sid === currentSessionId),
    expire: row.expire,
    clientIp: parsedSess.clientIp || '127.0.0.1',
    userAgent,
    deviceSummary: formatUserAgentSummary(userAgent),
    lastActive: parsedSess.lastActive || row.expire,
  };
};

export const listUserActiveSessions = async (
  userId,
  currentSessionId = null,
) => {
  if (!userId) return [];
  const normalizedUserId = String(userId);

  const [rows] = await db.sequelize.query(
    'SELECT sid, sess, expire FROM "session" WHERE expire > NOW() ORDER BY expire DESC',
  );

  const userSessions = [];
  for (const row of rows) {
    const sessionObj = mapSessionRow(row, normalizedUserId, currentSessionId);
    if (sessionObj) {
      userSessions.push(sessionObj);
    }
  }

  return userSessions;
};

export const revokeOtherSessions = async (userId, currentSessionId) => {
  if (!userId) return { revokedCount: 0 };
  const sessions = await listUserActiveSessions(userId, currentSessionId);
  const sidsToRevoke = sessions
    .filter((s) => !currentSessionId || s.sid !== currentSessionId)
    .map((s) => s.sid);

  if (sidsToRevoke.length === 0) {
    return { revokedCount: 0 };
  }

  const [result] = await db.sequelize.query(
    'DELETE FROM "session" WHERE sid IN (:sids)',
    {
      replacements: { sids: sidsToRevoke },
    },
  );

  return { revokedCount: sidsToRevoke.length, details: result };
};

export const revokeAllUserSessions = async (userId) => {
  if (!userId) return { revokedCount: 0 };
  const sessions = await listUserActiveSessions(userId);
  const sidsToRevoke = sessions.map((s) => s.sid);

  if (sidsToRevoke.length === 0) {
    return { revokedCount: 0 };
  }

  const [result] = await db.sequelize.query(
    'DELETE FROM "session" WHERE sid IN (:sids)',
    {
      replacements: { sids: sidsToRevoke },
    },
  );

  return { revokedCount: sidsToRevoke.length, details: result };
};

export const enrichSessionActivity = (req) => {
  if (!req?.session || !req?.user) return;
  const ipHeader = req.headers['x-forwarded-for'];
  const clientIp =
    (typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : null) ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Navegador Web';

  req.session.clientIp = clientIp;
  req.session.userAgent = userAgent;
  req.session.lastActive = new Date().toISOString();
};
