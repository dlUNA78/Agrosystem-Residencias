import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildCropImageRecords,
  cleanupUploadedCropFiles,
} from '../../src/services/cropImageService.js';
import { ensureImageUploadDirectory } from '../../src/middlewares/upload.js';

describe('ciclo de vida de imágenes de cultivos', () => {
  it('asigna una sola portada y conserva el orden de la galería', () => {
    const records = buildCropImageRecords({
      cropId: 8,
      files: [
        { filename: 'uno.png', originalname: 'uno original.png' },
        { filename: 'dos.webp', originalname: 'dos original.webp' },
      ],
      startOrder: 3,
      hasPrimary: false,
    });

    expect(records).toEqual([
      expect.objectContaining({ is_primary: true, display_order: 3 }),
      expect.objectContaining({ is_primary: false, display_order: 4 }),
    ]);
    expect(records[0].image_url).toBe('images/crops/uno.png');
  });

  it('elimina archivos compensatorios sólo dentro de images/crops', async () => {
    const cropDirectory = ensureImageUploadDirectory('crops');
    const cropFile = path.join(cropDirectory, `cleanup-${Date.now()}.png`);
    const externalDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'agrosystem-crop-cleanup-'),
    );
    const externalFile = path.join(externalDirectory, 'keep.png');
    fs.writeFileSync(cropFile, 'temporal');
    fs.writeFileSync(externalFile, 'conservar');

    try {
      await cleanupUploadedCropFiles([
        { path: cropFile },
        { path: externalFile },
      ]);

      expect(fs.existsSync(cropFile)).toBe(false);
      expect(fs.existsSync(externalFile)).toBe(true);
    } finally {
      fs.rmSync(cropFile, { force: true });
      fs.rmSync(externalDirectory, { recursive: true, force: true });
    }
  });
});
