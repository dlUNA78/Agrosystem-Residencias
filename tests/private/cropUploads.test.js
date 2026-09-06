import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import express from 'express';
import request from 'supertest';

import {
  IMAGE_UPLOAD_LIMITS,
  ensureImageUploadDirectory,
  uploadCropImages,
} from '../../src/middlewares/upload.js';

const pngImage = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const webpImage = Buffer.from('RIFF0000WEBP', 'ascii');

describe('seguridad de imágenes de cultivos', () => {
  it('acepta hasta diez imágenes válidas en una operación', async () => {
    const app = express();
    const uploadedPaths = [];

    app.post('/crops', uploadCropImages, (req, res) => {
      uploadedPaths.push(...req.files.map((file) => file.path));
      res.json({ files: req.files.map((file) => file.originalname) });
    });

    try {
      const response = await request(app)
        .post('/crops')
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
      expect(uploadedPaths).toHaveLength(2);
      expect(IMAGE_UPLOAD_LIMITS.files).toBe(10);
    } finally {
      uploadedPaths.forEach((filePath) => fs.rmSync(filePath, { force: true }));
    }
  });

  it('rechaza y elimina un archivo cuya firma no corresponde a PNG', async () => {
    const app = express();
    const cropDirectory = ensureImageUploadDirectory('crops');
    const filesBefore = new Set(fs.readdirSync(cropDirectory));

    app.post('/crops', uploadCropImages, (_req, res) => {
      res.sendStatus(204);
    });

    const response = await request(app)
      .post('/crops')
      .attach('images', Buffer.from('contenido-falsificado'), {
        filename: 'falso.png',
        contentType: 'image/png',
      });
    const filesAfter = new Set(fs.readdirSync(cropDirectory));

    expect(response.status).toBe(400);
    expect(response.text).toMatch(/contenido real/i);
    expect(filesAfter).toEqual(filesBefore);
  });
});
