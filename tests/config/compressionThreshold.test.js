import { afterAll, describe, expect, it } from '@jest/globals';
import compression from 'compression';
import express from 'express';
import request from 'supertest';
import { closeAppResources, COMPRESSION_OPTIONS } from '../../app.js';

afterAll(closeAppResources);

describe('1.A9 Umbral de compresión HTTP (threshold: 1024)', () => {
  it('configura threshold: 1024 para evitar comprimir respuestas menores a 1 KB', async () => {
    expect(COMPRESSION_OPTIONS).toEqual({ threshold: 1024 });

    const testApp = express();
    testApp.use(compression(COMPRESSION_OPTIONS));
    testApp.get('/small', (_req, res) => {
      res.type('text/plain').send('ok'.repeat(100)); // 200 bytes (< 1024 B)
    });
    testApp.get('/large', (_req, res) => {
      res.type('text/plain').send('agrosystem-payload-'.repeat(120)); // > 1024 B
    });

    const smallRes = await request(testApp)
      .get('/small')
      .set('Accept-Encoding', 'gzip');
    expect(smallRes.status).toBe(200);
    expect(smallRes.headers['content-encoding']).toBeUndefined();

    const largeRes = await request(testApp)
      .get('/large')
      .set('Accept-Encoding', 'gzip');
    expect(largeRes.status).toBe(200);
    expect(largeRes.headers['content-encoding']).toBe('gzip');
  });
});
