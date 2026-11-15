/* global __ENV */

export const DEFAULT_BASE_URL = 'http://localhost:3000';

export const getRuntimeEnv = (customEnv) => {
  if (customEnv && typeof customEnv === 'object') {
    return customEnv;
  }
  if (typeof __ENV !== 'undefined') {
    return __ENV;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
};

export const normalizeBaseUrl = (rawUrl) => {
  const candidate = String(rawUrl || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, '');

  if (!/^https?:\/\/\S+$/i.test(candidate)) {
    throw new Error(
      `BASE_URL inválida ("${candidate}"). Debe iniciar con http:// o https://.`,
    );
  }

  return candidate;
};

export const parsePositiveInt = (rawValue, fallback) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

export const parseNonNegativeNumber = (rawValue, fallback) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
};

export const parseRateThreshold = (rawValue, fallback) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
};

export const resolveThresholdConfig = (env, defaults) => {
  const p95Ms = parsePositiveInt(env?.K6_P95_MS, defaults.p95Ms);
  const defaultP99 = defaults.p99Ms ?? p95Ms * 2;
  const p99Ms = parsePositiveInt(
    env?.K6_P99_MS,
    env?.K6_P95_MS ? Math.max(defaultP99, p95Ms * 2) : defaultP99,
  );

  return {
    errorRate: parseRateThreshold(
      env?.K6_ERROR_RATE,
      defaults.errorRate ?? 0.01,
    ),
    checkRate: parseRateThreshold(
      env?.K6_CHECK_RATE,
      defaults.checkRate ?? 0.99,
    ),
    p95Ms,
    p99Ms,
  };
};

export const getCredentials = (
  env = getRuntimeEnv(),
  { required = true } = {},
) => {
  const email = String(env.LOADTEST_EMAIL || '').trim();
  const password = String(env.LOADTEST_PASSWORD || '');

  if (required && (!email || !password)) {
    throw new Error(
      'Faltan credenciales de prueba: define LOADTEST_EMAIL y LOADTEST_PASSWORD por variables de entorno.',
    );
  }

  return { email, password };
};

const buildRampStages = (env, vus, duration) => {
  const rampUp = String(env.K6_RAMP_UP || '').trim();
  if (!rampUp) return null;

  const stages = [
    { duration: rampUp, target: vus },
    { duration: duration || '1m', target: vus },
  ];
  const rampDown = String(env.K6_RAMP_DOWN || '').trim();
  if (rampDown) {
    stages.push({ duration: rampDown, target: 0 });
  }
  return stages;
};

export const buildWorkloadOptions = (
  env,
  { defaultVus = 2, defaultIterations = 3, thresholds = {} } = {},
) => {
  const vus = parsePositiveInt(env.K6_VUS, defaultVus);
  const duration = String(env.K6_DURATION || '').trim();
  const stages = buildRampStages(env, vus, duration);

  if (stages) {
    return { stages, thresholds };
  }

  if (duration) {
    return { vus, duration, thresholds };
  }

  return {
    vus,
    iterations: parsePositiveInt(env.K6_ITERATIONS, defaultIterations),
    thresholds,
  };
};

const extractCookieFromSetCookieHeader = (headerValue, cookieName) => {
  if (!headerValue) return '';
  const headers = Array.isArray(headerValue) ? headerValue : [headerValue];
  const prefix = `${cookieName}=`;

  for (const raw of headers) {
    const firstPart = String(raw || '')
      .split(';')[0]
      .trim();
    if (firstPart.startsWith(prefix)) {
      return firstPart.slice(prefix.length);
    }
  }

  return '';
};

export const extractCookieValue = (response, cookieName = 'connect.sid') => {
  const k6Cookies = response?.cookies?.[cookieName];
  if (Array.isArray(k6Cookies) && k6Cookies[0]?.value) {
    return String(k6Cookies[0].value);
  }

  const headers = response?.headers || {};
  const setCookie = headers['Set-Cookie'] || headers['set-cookie'];
  return extractCookieFromSetCookieHeader(setCookie, cookieName);
};

export const parseFirstRecordId = (rawBody, collectionKey) => {
  if (!rawBody) return null;
  try {
    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const list = parsed?.[collectionKey];
    const firstId = Array.isArray(list) ? list[0]?.id : null;
    return Number.isInteger(Number(firstId)) && Number(firstId) > 0
      ? Number(firstId)
      : null;
  } catch {
    return null;
  }
};

export const hasPdfSignature = (body) => {
  if (!body) return false;

  if (typeof body === 'string') {
    return body.startsWith('%PDF');
  }

  if (body instanceof ArrayBuffer) {
    const bytes = new Uint8Array(body);
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    );
  }

  return false;
};

export const getContentTypeHeader = (headers = {}) =>
  String(headers['Content-Type'] || headers['content-type'] || '');

/**
 * Elimina cookieHeader de setup_data in-place para evitar exponer sesiones
 * en --summary-export y salidas JSON de k6.
 */
export const sanitizeSummaryData = (data) => {
  if (
    data?.setup_data &&
    typeof data.setup_data === 'object' &&
    Object.hasOwn(data.setup_data, 'cookieHeader')
  ) {
    delete data.setup_data.cookieHeader;
  }
  return data;
};

/**
 * Callback compartido de handleSummary para k6: limpia setup_data y preserva
 * tanto el resumen estándar en stdout como --summary-export al retornar undefined.
 */
export const handleSanitizedSummary = (data) => {
  sanitizeSummaryData(data);
  return undefined;
};
