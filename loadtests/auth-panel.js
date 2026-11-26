import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
  buildRequestHeaders,
  buildWorkloadOptions,
  extractCookieValue,
  getCredentials,
  getRuntimeEnv,
  handleSanitizedSummary,
  normalizeBaseUrl,
  parseNonNegativeNumber,
  resolveThresholdConfig,
  SESSION_COOKIE_NAME,
} from './lib/config.js';

const env = getRuntimeEnv();
const BASE_URL = normalizeBaseUrl(env.BASE_URL);
const SLEEP_SECONDS = parseNonNegativeNumber(env.K6_SLEEP, 0.2);
const ROLE = String(env.LOADTEST_ROLE || 'admin')
  .trim()
  .toLowerCase();

const loginDuration = new Trend('auth_login_duration', true);
const dashboardDuration = new Trend('private_dashboard_duration', true);
const listDuration = new Trend('private_list_duration', true);

const { errorRate, checkRate, p95Ms, p99Ms } = resolveThresholdConfig(env, {
  errorRate: 0.01,
  checkRate: 0.99,
  p95Ms: 2000,
  p99Ms: 4000,
});
const listP95Ms = env.K6_P95_MS ? p95Ms : 2500;

export const options = buildWorkloadOptions(env, {
  defaultVus: 2,
  defaultIterations: 2,
  thresholds: {
    http_req_failed: [`rate<${errorRate}`],
    checks: [`rate>${checkRate}`],
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
    auth_login_duration: [`p(95)<${p95Ms}`],
    private_dashboard_duration: [`p(95)<${p95Ms}`],
    private_list_duration: [`p(95)<${listP95Ms}`],
  },
});

export function setup() {
  const { email, password } = getCredentials(env, { required: true });

  const loginPageRes = http.get(`${BASE_URL}/auth/login`, {
    headers: buildRequestHeaders({}, env),
    tags: { name: 'auth_login_page' },
  });
  check(loginPageRes, {
    'GET /auth/login: status 200': (r) => r.status === 200,
  });

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    { email, password },
    { redirects: 0, tags: { name: 'auth_login_post' } },
  );
  loginDuration.add(loginRes.timings.duration);

  if (loginRes.status === 429) {
    throw new Error(
      'POST /auth/login devolvió 429 (authLimiter: 5 intentos / 15 min por IP). Espera antes de reintentar.',
    );
  }

  const sessionId = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
  const loginOk = check(loginRes, {
    'POST /auth/login: redirección exitosa (302)': (r) => r.status === 302,
    [`POST /auth/login: emite cookie ${SESSION_COOKIE_NAME}`]: () =>
      Boolean(sessionId),
  });

  if (!loginOk || !sessionId) {
    throw new Error(
      `Autenticación fallida en POST /auth/login (HTTP ${loginRes.status}). Verifica LOADTEST_EMAIL y LOADTEST_PASSWORD.`,
    );
  }

  return {
    baseUrl: BASE_URL,
    cookieHeader: `${SESSION_COOKIE_NAME}=${sessionId}`,
    includeAdminRoutes: ROLE === 'admin',
  };
}

const getPrivatePage = (url, tagName, cookieHeader, metricTrend) => {
  const res = http.get(url, {
    headers: buildRequestHeaders({ Cookie: cookieHeader }, env),
    tags: { name: tagName },
  });
  metricTrend.add(res.timings.duration);

  check(res, {
    [`${tagName}: status 200`]: (r) => r.status === 200,
    [`${tagName}: mantiene sesión autenticada`]: (r) =>
      !String(r.url || '').includes('/auth/login'),
  });
};

export default function (data) {
  group('Dashboard privado', () => {
    getPrivatePage(
      `${data.baseUrl}/dashboard`,
      'private_dashboard',
      data.cookieHeader,
      dashboardDuration,
    );
  });

  group('Listados privados de operación y catálogos', () => {
    const routes = [
      ['/private/crops', 'private_crops_list'],
      ['/private/plagues', 'private_plagues_list'],
      ['/private/products', 'private_products_list'],
      ['/private/lands', 'private_lands_list'],
      ['/private/ingredients', 'private_ingredients_list'],
      ['/private/suppliers', 'private_suppliers_list'],
      ['/private/reports', 'private_reports'],
    ];

    if (data.includeAdminRoutes) {
      routes.push(['/private/audit', 'private_audit_list']);
      routes.push(['/private/users', 'private_users_list']);
    }

    for (const [routePath, tagName] of routes) {
      getPrivatePage(
        `${data.baseUrl}${routePath}`,
        tagName,
        data.cookieHeader,
        listDuration,
      );
    }
  });

  group('Notificaciones privadas JSON', () => {
    const notifRes = http.get(`${data.baseUrl}/api/notifications`, {
      headers: buildRequestHeaders(
        {
          Cookie: data.cookieHeader,
          Accept: 'application/json',
        },
        env,
      ),
      tags: { name: 'api_notifications' },
    });
    listDuration.add(notifRes.timings.duration);

    check(notifRes, {
      'api_notifications: status 200': (r) => r.status === 200,
      'api_notifications: JSON válido': (r) => {
        try {
          return JSON.parse(r.body)?.success === true;
        } catch {
          return false;
        }
      },
    });
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
      tags: { name: 'auth_logout' },
    },
  );
}

export function handleSummary(data) {
  return handleSanitizedSummary(data);
}
