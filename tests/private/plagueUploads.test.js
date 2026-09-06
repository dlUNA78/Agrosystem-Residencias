import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

import {
  IMAGE_UPLOAD_LIMITS,
  ensureImageUploadDirectory,
  uploadPlagueImages,
  validateImageFile,
  validateImageSignature,
} from '../../src/middlewares/upload.js';

const pngImage = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const webpImage = Buffer.from('RIFF0000WEBP', 'ascii');

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

  it('crea recursivamente la carpeta de plagas en cualquier clon', () => {
    const temporaryPublic = fs.mkdtempSync(
      path.join(os.tmpdir(), 'agrosystem-upload-'),
    );

    try {
      const directory = ensureImageUploadDirectory('plagues', temporaryPublic);

      expect(directory).toBe(path.join(temporaryPublic, 'images', 'plagues'));
      expect(fs.statSync(directory).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(temporaryPublic, { recursive: true, force: true });
    }
  });

  it('valida la firma binaria real de la imagen', async () => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'agrosystem-signature-'),
    );
    const validPath = path.join(temporaryDirectory, 'valid.png');
    const forgedPath = path.join(temporaryDirectory, 'forged.png');

    try {
      fs.writeFileSync(validPath, pngImage);
      fs.writeFileSync(forgedPath, Buffer.from('no-es-una-imagen'));

      await expect(
        validateImageSignature(validPath, 'image/png'),
      ).resolves.toBe(true);
      await expect(
        validateImageSignature(forgedPath, 'image/png'),
      ).rejects.toThrow(/contenido real/i);
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('acepta varias imágenes de plaga en el mismo formulario', async () => {
    const app = express();
    const uploadedPaths = [];

    app.post('/plagues', uploadPlagueImages, (req, res) => {
      uploadedPaths.push(...req.files.map((file) => file.path));
      res.json({ files: req.files.map((file) => file.originalname) });
    });

    try {
      const response = await request(app)
        .post('/plagues')
        .attach('images', pngImage, {
          filename: 'uno.png',
          contentType: 'image/png',
        })
        .attach('images', webpImage, {
          filename: 'dos.webp',
          contentType: 'image/webp',
        });

      expect(response.status).toBe(200);
      expect(response.body.files).toEqual(['uno.png', 'dos.webp']);
    } finally {
      uploadedPaths.forEach((filePath) => fs.rmSync(filePath, { force: true }));
    }
  });
});
