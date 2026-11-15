import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildWorkloadOptions,
  DEFAULT_BASE_URL,
  extractCookieValue,
  getContentTypeHeader,
  getCredentials,
  handleSanitizedSummary,
  hasPdfSignature,
  normalizeBaseUrl,
  parseFirstRecordId,
  parseNonNegativeNumber,
  parsePositiveInt,
  parseRateThreshold,
  resolveThresholdConfig,
  sanitizeSummaryData,
} from '../../loadtests/lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loadtestsDir = path.resolve(__dirname, '../../loadtests');

describe('loadtests/lib/config', () => {
  it('normalizes BASE_URL and rejects non-HTTP schemes', () => {
    expect(normalizeBaseUrl()).toBe(DEFAULT_BASE_URL);
    expect(normalizeBaseUrl('http://127.0.0.1:3000///')).toBe(
      'http://127.0.0.1:3000',
    );
    expect(() => normalizeBaseUrl('ftp://example.com')).toThrow(
      /BASE_URL inválida/i,
    );
  });

  it('parses positive integers and non-negative numbers with fallbacks', () => {
    expect(parsePositiveInt('5', 2)).toBe(5);
    expect(parsePositiveInt('0', 2)).toBe(2);
    expect(parsePositiveInt('abc', 2)).toBe(2);
    expect(parseNonNegativeNumber('0', 0.5)).toBe(0);
    expect(parseNonNegativeNumber('-1', 0.5)).toBe(0.5);
  });

  it('requires LOADTEST_EMAIL and LOADTEST_PASSWORD when required=true', () => {
    expect(() => getCredentials({}, { required: true })).toThrow(
      /LOADTEST_EMAIL/,
    );
    expect(
      getCredentials(
        { LOADTEST_EMAIL: ' user@example.test ', LOADTEST_PASSWORD: 'secret' },
        { required: true },
      ),
    ).toEqual({
      email: 'user@example.test',
      password: 'secret',
    });
  });

  it('builds workload options with iterations by default or duration when set', () => {
    const iterOpts = buildWorkloadOptions(
      { K6_VUS: '4', K6_ITERATIONS: '8' },
      { thresholds: { checks: ['rate>0.99'] } },
    );
    expect(iterOpts).toEqual({
      vus: 4,
      iterations: 8,
      thresholds: { checks: ['rate>0.99'] },
    });

    const durOpts = buildWorkloadOptions(
      { K6_VUS: '5', K6_DURATION: '20s' },
      { thresholds: { checks: ['rate>0.99'] } },
    );
    expect(durOpts).toEqual({
      vus: 5,
      duration: '20s',
      thresholds: { checks: ['rate>0.99'] },
    });

    const rampOpts = buildWorkloadOptions(
      {
        K6_VUS: '200',
        K6_RAMP_UP: '20s',
        K6_DURATION: '2m',
        K6_RAMP_DOWN: '10s',
      },
      { thresholds: { checks: ['rate>0.98'] } },
    );
    expect(rampOpts).toEqual({
      stages: [
        { duration: '20s', target: 200 },
        { duration: '2m', target: 200 },
        { duration: '10s', target: 0 },
      ],
      thresholds: { checks: ['rate>0.98'] },
    });
  });

  it('resolves rate and p95/p99 thresholds with fallbacks and env overrides', () => {
    expect(parseRateThreshold('0.02', 0.01)).toBe(0.02);
    expect(parseRateThreshold('1.5', 0.01)).toBe(0.01);
    expect(parseRateThreshold('-0.1', 0.01)).toBe(0.01);

    expect(
      resolveThresholdConfig(
        {},
        { errorRate: 0.01, checkRate: 0.99, p95Ms: 1500, p99Ms: 3000 },
      ),
    ).toEqual({ errorRate: 0.01, checkRate: 0.99, p95Ms: 1500, p99Ms: 3000 });

    expect(
      resolveThresholdConfig(
        {
          K6_P95_MS: '3000',
          K6_ERROR_RATE: '0.05',
          K6_CHECK_RATE: '0.98',
        },
        { errorRate: 0.01, checkRate: 0.99, p95Ms: 1500, p99Ms: 3000 },
      ),
    ).toEqual({ errorRate: 0.05, checkRate: 0.98, p95Ms: 3000, p99Ms: 6000 });
  });

  it('extracts connect.sid cookie from k6 cookies map or Set-Cookie headers', () => {
    expect(
      extractCookieValue({
        cookies: { 'connect.sid': [{ value: 'abc123' }] },
      }),
    ).toBe('abc123');

    expect(
      extractCookieValue({
        headers: {
          'Set-Cookie': ['other=1; Path=/', 'connect.sid=xyz789; HttpOnly'],
        },
      }),
    ).toBe('xyz789');

    expect(extractCookieValue({})).toBe('');
  });

  it('parses first record id safely from JSON payloads', () => {
    expect(parseFirstRecordId('{"crops":[{"id":7}]}', 'crops')).toBe(7);
    expect(parseFirstRecordId('{"crops":[]}', 'crops')).toBeNull();
    expect(parseFirstRecordId('not-json', 'crops')).toBeNull();
  });

  it('validates %PDF binary signatures and content-type headers', () => {
    expect(hasPdfSignature('%PDF-1.4\n...')).toBe(true);
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer;
    expect(hasPdfSignature(pdfBytes)).toBe(true);
    expect(hasPdfSignature('<html></html>')).toBe(false);
    expect(getContentTypeHeader({ 'content-type': 'application/pdf' })).toBe(
      'application/pdf',
    );
  });

  it('strips cookieHeader from summary setup_data while keeping metadata intact', () => {
    const summary = {
      metrics: { http_reqs: { count: 10 } },
      setup_data: {
        baseUrl: 'http://localhost:3000',
        cookieHeader: 'connect.sid=s%3Asensitive-session-token',
        cropId: 1,
      },
    };

    const sanitized = sanitizeSummaryData(summary);
    expect(sanitized.setup_data).toEqual({
      baseUrl: 'http://localhost:3000',
      cropId: 1,
    });
    expect(sanitized.setup_data).not.toHaveProperty('cookieHeader');
    expect(sanitizeSummaryData(null)).toBeNull();
    expect(sanitizeSummaryData({ metrics: {} })).toEqual({ metrics: {} });

    const withCookie = {
      setup_data: { baseUrl: 'http://localhost:3000', cookieHeader: 'secret' },
    };
    expect(handleSanitizedSummary(withCookie)).toBeUndefined();
    expect(withCookie.setup_data).not.toHaveProperty('cookieHeader');
  });
});

describe('loadtests k6 scripts contract & secret hygiene', () => {
  const scriptFiles = ['catalog.js', 'auth-panel.js', 'pdf.js'];
  const rootDir = path.resolve(__dirname, '../..');

  it.each(scriptFiles)(
    '%s defines thresholds, handleSummary sanitization, and no hardcoded credentials',
    async (fileName) => {
      const content = await fs.readFile(
        path.join(loadtestsDir, fileName),
        'utf8',
      );
      expect(content).toContain('thresholds:');
      expect(content).toContain('http_req_failed');
      expect(content).toContain('http_req_duration');
      expect(content).toContain('export function handleSummary');
      expect(content).toContain('handleSanitizedSummary');
      expect(content).not.toMatch(/@agrosystem\.com/i);
      expect(content).not.toMatch(/admin123|123456/);
    },
  );

  it('ignores loadtests/results/ in .gitignore to keep raw exports out of git', async () => {
    const gitignore = await fs.readFile(
      path.join(rootDir, '.gitignore'),
      'utf8',
    );
    expect(gitignore).toMatch(/^loadtests\/results\/$/m);
  });
});
