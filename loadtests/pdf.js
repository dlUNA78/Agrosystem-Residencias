import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
  buildRequestHeaders,
  buildWorkloadOptions,
  extractCookieValue,
  getContentTypeHeader,
  getCredentials,
  getRuntimeEnv,
  handleSanitizedSummary,
  hasPdfSignature,
  normalizeBaseUrl,
  parseFirstRecordId,
  parseNonNegativeNumber,
  parsePositiveInt,
  resolveThresholdConfig,
  SESSION_COOKIE_NAME,
} from './lib/config.js';

const env = getRuntimeEnv();
const BASE_URL = normalizeBaseUrl(env.BASE_URL);
const SLEEP_SECONDS = parseNonNegativeNumber(env.K6_SLEEP, 0.2);
const PDF_CROP_SCOPE = String(env.PDF_CROP_SCOPE || 'public')
  .trim()
  .toLowerCase();
const REPORT_PERIOD = String(env.REPORT_PERIOD || 'mensual')
  .trim()
  .toLowerCase();

const cropPdfDuration = new Trend('pdf_crop_duration', true);
const reportPdfDuration = new Trend('pdf_report_duration', true);

const { errorRate, checkRate, p95Ms, p99Ms } = resolveThresholdConfig(env, {
  errorRate: 0.01,
  checkRate: 0.99,
  p95Ms: 3000,
  p99Ms: 5000,
});
const reportP95Ms = env.K6_P95_MS ? p95Ms : 3500;

export const options = buildWorkloadOptions(env, {
  defaultVus: 2,
  defaultIterations: 4,
  thresholds: {
    http_req_failed: [`rate<${errorRate}`],
    checks: [`rate>${checkRate}`],
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
    pdf_crop_duration: [`p(95)<${p95Ms}`],
    pdf_report_duration: [`p(95)<${reportP95Ms}`],
  },
});

const resolveCropId = () => {
  const configured = parsePositiveInt(env.CROP_ID, null);
  if (configured) return configured;

  const res = http.get(`${BASE_URL}/api/crops`, {
    headers: buildRequestHeaders({}, env),
    tags: { name: 'setup_crops_lookup' },
  });
  if (res.status !== 200) {
    throw new Error(
      `Fallo al consultar /api/crops en setup() (HTTP ${res.status}).`,
    );
  }
  const id = parseFirstRecordId(res.body, 'crops');
  if (!id) {
    throw new Error('No se encontró ningún cultivo publicado para PDF.');
  }
  return id;
};

export function setup() {
  const { email, password } = getCredentials(env, { required: true });
  const cropId = resolveCropId();

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    { email, password },
    { redirects: 0, tags: { name: 'pdf_setup_login' } },
  );

  if (loginRes.status === 429) {
    throw new Error(
      'POST /auth/login devolvió 429 (authLimiter: 5 intentos / 15 min por IP). Espera antes de reintentar.',
    );
  }

  const sessionId = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
  if (loginRes.status !== 302 || !sessionId) {
    throw new Error(
      `Autenticación fallida en setup() (HTTP ${loginRes.status}). Verifica LOADTEST_EMAIL y LOADTEST_PASSWORD.`,
    );
  }

  return {
    baseUrl: BASE_URL,
    cropId,
    cropScope: PDF_CROP_SCOPE === 'private' ? 'private' : 'public',
    reportPeriod: REPORT_PERIOD,
    cookieHeader: `${SESSION_COOKIE_NAME}=${sessionId}`,
  };
}

const verifyPdfDownload = (url, tagName, headers, metricTrend) => {
  const res = http.get(url, {
    headers: buildRequestHeaders(headers, env),
    responseType: 'binary',
    tags: { name: tagName },
  });
  metricTrend.add(res.timings.duration);

  const byteLength =
    res.body instanceof ArrayBuffer
      ? res.body.byteLength
      : String(res.body || '').length;

  check(res, {
    [`${tagName}: status 200`]: (r) => r.status === 200,
    [`${tagName}: Content-Type application/pdf`]: (r) =>
      getContentTypeHeader(r.headers).toLowerCase().includes('application/pdf'),
    [`${tagName}: firma binaria %PDF válida`]: (r) => hasPdfSignature(r.body),
    [`${tagName}: tamaño > 500 bytes`]: () => byteLength > 500,
  });
};

export default function (data) {
  group('PDF ficha técnica de cultivo', () => {
    const cropPath =
      data.cropScope === 'private'
        ? `/private/crops/${data.cropId}?format=pdf&download=1`
        : `/crops/${data.cropId}?format=pdf&download=1`;
    const headers =
      data.cropScope === 'private' ? { Cookie: data.cookieHeader } : {};

    verifyPdfDownload(
      `${data.baseUrl}${cropPath}`,
      'pdf_crop',
      headers,
      cropPdfDuration,
    );
  });

  group('PDF reporte operativo', () => {
    verifyPdfDownload(
      `${data.baseUrl}/private/reports?period=${encodeURIComponent(data.reportPeriod)}&format=pdf`,
      'pdf_report',
      { Cookie: data.cookieHeader },
      reportPdfDuration,
    );
  });

  if (SLEEP_SECONDS > 0) {
    sleep(SLEEP_SECONDS);
  }
}

export function teardown(data) {
  if (!data?.cookieHeader) return;
  http.post(
    `${data.baseUrl}/auth/logout`,
    {},
    {
      headers: { Cookie: data.cookieHeader },
      redirects: 0,
      tags: { name: 'pdf_teardown_logout' },
    },
  );
}

export function handleSummary(data) {
  return handleSanitizedSummary(data);
}
