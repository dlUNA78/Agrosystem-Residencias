import { describe, expect, it } from '@jest/globals';

import {
  IMAGE_UPLOAD_LIMITS,
  validateImageFile,
} from '../../src/middlewares/upload.js';

describe('seguridad de imágenes de plagas', () => {
  it('limita cada imagen a 5 MB', () => {
    expect(IMAGE_UPLOAD_LIMITS.fileSize).toBe(5 * 1024 * 1024);
  });

  it.each([
    ['plaga.jpg', 'image/jpeg'],
    ['plaga.jpeg', 'image/jpeg'],
    ['plaga.png', 'image/png'],
    ['plaga.webp', 'image/webp'],
  ])('acepta %s con MIME %s', (originalname, mimetype) => {
    expect(validateImageFile({ originalname, mimetype })).toBe(true);
  });

  it.each([
    ['plaga.svg', 'image/svg+xml'],
    ['plaga.exe', 'image/jpeg'],
    ['plaga.jpg', 'application/octet-stream'],
    ['plaga.png.exe', 'image/png'],
  ])('rechaza %s con MIME %s', (originalname, mimetype) => {
    expect(() => validateImageFile({ originalname, mimetype })).toThrow(
      /JPG, PNG o WEBP/,
    );
  });
});
