import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  MAX_PLAGUE_IMAGES,
  buildPlagueImageRecords,
  buildPlagueImageUpdatePlan,
  cleanupStoredPlagueImages,
  parseRemovedPlagueImageIds,
} from '../../src/services/plagueImageService.js';

describe('reglas de la galería de plagas', () => {
  it('mantiene el límite normativo de 10 imágenes', () => {
    expect(MAX_PLAGUE_IMAGES).toBe(10);
  });

  it('normaliza y elimina duplicados de los IDs a quitar', () => {
    expect(parseRemovedPlagueImageIds(['7', '8', '7'])).toEqual([7, 8]);
    expect(parseRemovedPlagueImageIds('7, 8,7')).toEqual([7, 8]);
    expect(parseRemovedPlagueImageIds(undefined)).toEqual([]);
  });

  it.each(['0', '-1', 'texto', '2.5', ['3', 'otro']])(
    'rechaza una selección manipulada: %p',
    (value) => {
      expect(parseRemovedPlagueImageIds(value)).toBeNull();
    },
  );

  it('construye rutas relativas y continúa el orden de la galería', () => {
    expect(
      buildPlagueImageRecords({
        plagueId: 41,
        files: [{ filename: 'nueva.png' }, { filename: 'otra.webp' }],
        startOrder: 8,
      }),
    ).toEqual([
      {
        plague_id: 41,
        url: 'images/plagues/nueva.png',
        sort_order: 8,
      },
      {
        plague_id: 41,
        url: 'images/plagues/otra.webp',
        sort_order: 9,
      },
    ]);
  });

  it('calcula el límite acumulado y evita reutilizar órdenes existentes', () => {
    const existingImages = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1,
      sort_order: index,
    }));
    const plan = buildPlagueImageUpdatePlan({
      existingImages,
      removedImageIds: [1, 2],
      newFileCount: 2,
    });

    expect(plan.error).toBeNull();
    expect(plan.removedImages).toHaveLength(2);
    expect(plan.nextImageOrder).toBe(10);
    expect(
      buildPlagueImageUpdatePlan({
        existingImages,
        removedImageIds: [],
        newFileCount: 1,
      }).error,
    ).toMatch(/máximo 10 imágenes/i);
  });

  it('elimina sólo archivos almacenados dentro de images/plagues', async () => {
    const plagueDirectory = path.resolve('public/images/plagues');
    fs.mkdirSync(plagueDirectory, { recursive: true });
    const plagueFileName = `cleanup-${Date.now()}.png`;
    const plagueFile = path.join(plagueDirectory, plagueFileName);
    const externalDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'agrosystem-plague-cleanup-'),
    );
    const externalFile = path.join(externalDirectory, 'keep.png');
    fs.writeFileSync(plagueFile, 'temporal');
    fs.writeFileSync(externalFile, 'conservar');

    try {
      await cleanupStoredPlagueImages([
        { url: `images/plagues/${plagueFileName}` },
        { url: `../${externalFile}` },
      ]);

      expect(fs.existsSync(plagueFile)).toBe(false);
      expect(fs.existsSync(externalFile)).toBe(true);
    } finally {
      fs.rmSync(plagueFile, { force: true });
      fs.rmSync(externalDirectory, { recursive: true, force: true });
    }
  });
});
