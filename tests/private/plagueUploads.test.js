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
        .attach('images', Buffer.from('imagen-uno'), {
          filename: 'uno.png',
          contentType: 'image/png',
        })
        .attach('images', Buffer.from('imagen-dos'), {
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
