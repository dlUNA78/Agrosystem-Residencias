import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import {
  buildWorkloadOptions,
  getRuntimeEnv,
  handleSanitizedSummary,
  normalizeBaseUrl,
  parseFirstRecordId,
  parseNonNegativeNumber,
  parsePositiveInt,
  resolveThresholdConfig,
} from './lib/config.js';

const env = getRuntimeEnv();
const BASE_URL = normalizeBaseUrl(env.BASE_URL);
const SLEEP_SECONDS = parseNonNegativeNumber(env.K6_SLEEP, 0.2);

const homeDuration = new Trend('catalog_home_duration', true);
const listDuration = new Trend('catalog_list_duration', true);
const detailDuration = new Trend('catalog_detail_duration', true);

const { errorRate, checkRate, p95Ms, p99Ms } = resolveThresholdConfig(env, {
  errorRate: 0.01,
  checkRate: 0.99,
  p95Ms: 1500,
  p99Ms: 3000,
});

export const options = buildWorkloadOptions(env, {
  defaultVus: 2,
  defaultIterations: 3,
  thresholds: {
    http_req_failed: [`rate<${errorRate}`],
    checks: [`rate>${checkRate}`],
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
    catalog_home_duration: [`p(95)<${p95Ms}`],
    catalog_list_duration: [`p(95)<${p95Ms}`],
    catalog_detail_duration: [`p(95)<${p95Ms}`],
  },
});

const fetchFirstPublicId = (endpoint, collectionKey) => {
  const res = http.get(`${BASE_URL}${endpoint}`, {
    tags: { name: `setup_${collectionKey}` },
  });
  if (res.status !== 200) {
    throw new Error(
      `Fallo al consultar ${endpoint} en setup() (HTTP ${res.status}).`,
    );
  }
  const id = parseFirstRecordId(res.body, collectionKey);
  if (!id) {
    throw new Error(
      `No se encontró ningún registro publicado en ${endpoint} para pruebas de detalle.`,
    );
  }
  return id;
};

export function setup() {
  const cropId =
    parsePositiveInt(env.CROP_ID, null) ||
    fetchFirstPublicId('/api/crops', 'crops');
  const plagueId =
    parsePositiveInt(env.PLAGUE_ID, null) ||
    fetchFirstPublicId('/api/plagues', 'plagues');
  const productId =
    parsePositiveInt(env.PRODUCT_ID, null) ||
    fetchFirstPublicId('/api/products', 'products');

  return {
    baseUrl: BASE_URL,
    cropId,
    plagueId,
    productId,
  };
}

const verifyHtmlRoute = (url, tagName, metricTrend, expectedSnippet) => {
  const res = http.get(url, { tags: { name: tagName } });
  metricTrend.add(res.timings.duration);

  check(res, {
    [`${tagName}: status 200`]: (r) => r.status === 200,
    [`${tagName}: contiene HTML esperado`]: (r) =>
      Boolean(r.body && r.body.includes(expectedSnippet)),
  });
};

export default function (data) {
  group('Home institucional', () => {
    verifyHtmlRoute(
      `${data.baseUrl}/`,
      'public_home',
      homeDuration,
      'AgroSystem',
    );
  });

  group('Listados públicos de catálogo', () => {
    verifyHtmlRoute(
      `${data.baseUrl}/crops`,
      'public_crops_list',
      listDuration,
      'Cultivos',
    );
    verifyHtmlRoute(
      `${data.baseUrl}/plagues`,
      'public_plagues_list',
      listDuration,
      'Plagas',
    );
    verifyHtmlRoute(
      `${data.baseUrl}/products`,
      'public_products_list',
      listDuration,
      'Productos',
    );
  });

  group('Detalle público de fichas', () => {
    verifyHtmlRoute(
      `${data.baseUrl}/crops/${data.cropId}`,
      'public_crop_detail',
      detailDuration,
      '<!DOCTYPE',
    );
    verifyHtmlRoute(
      `${data.baseUrl}/plagues/${data.plagueId}`,
      'public_plague_detail',
      detailDuration,
      '<!DOCTYPE',
    );
    verifyHtmlRoute(
      `${data.baseUrl}/products/${data.productId}`,
      'public_product_detail',
      detailDuration,
      '<!DOCTYPE',
    );
  });

  if (SLEEP_SECONDS > 0) {
    sleep(SLEEP_SECONDS);
  }
}

export function handleSummary(data) {
  return handleSanitizedSummary(data);
}
