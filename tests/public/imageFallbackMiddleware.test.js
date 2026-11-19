import fs from 'fs';
import fsPromises from 'fs/promises';
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';
import app, {
  clearImageFallbackCache,
  closeAppResources,
  resolveFallbackImageUrl,
} from '../../app.js';

afterAll(closeAppResources);

describe('1.A9 Middleware de imágenes sin I/O síncrono por petición', () => {
  beforeEach(() => {
    clearImageFallbackCache();
  });

  it('sirve imágenes existentes, extensiones alternas y fallback por defecto sin ejecutar fs.existsSync', async () => {
    const existsSyncSpy = jest.spyOn(fs, 'existsSync');

    try {
      const directWebp = await request(app).get('/images/cultivos/maiz.webp');
      expect(directWebp.status).toBe(200);
      expect(directWebp.headers['content-type']).toContain('image/webp');

      const altExtJpg = await request(app).get('/images/cultivos/maiz.jpg');
      expect(altExtJpg.status).toBe(200);
      expect(altExtJpg.headers['content-type']).toContain('image/webp');

      const defaultFallback = await request(app).get(
        '/images/cultivos/cultivo-inexistente-1a9.png',
      );
      expect(defaultFallback.status).toBe(200);
      expect(defaultFallback.headers['content-type']).toContain('image/png');

      expect(existsSyncSpy).not.toHaveBeenCalled();
    } finally {
      existsSyncSpy.mockRestore();
    }
  });

  it('almacena en caché las resoluciones de fallback y rechaza rutas fuera de public/', async () => {
    const accessSpy = jest.spyOn(fsPromises, 'access');

    try {
      const firstResolution = await resolveFallbackImageUrl(
        '/images/cultivos/maiz.jpg',
      );
      expect(firstResolution).toBe('/images/cultivos/maiz.webp');
      const callsAfterFirst = accessSpy.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // Segunda consulta usa caché en memoria sin tocar fsPromises.access
      const cachedResolution = await resolveFallbackImageUrl(
        '/images/cultivos/maiz.jpg',
      );
      expect(cachedResolution).toBe('/images/cultivos/maiz.webp');
      expect(accessSpy.mock.calls.length).toBe(callsAfterFirst);

      // Intento de path traversal fuera de public/
      const traversal = await resolveFallbackImageUrl(
        '/images/cultivos/../../../package.json',
      );
      expect(traversal).toBeNull();
    } finally {
      accessSpy.mockRestore();
    }
  });
});
