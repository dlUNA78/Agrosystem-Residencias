import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  MAX_PLAGUE_IMAGES,
  buildExistingPlagueImageSourceUpdates,
  buildPlagueImageRecords,
  buildPlagueImageUpdatePlan,
  cleanupStoredPlagueImages,
  parseRemovedPlagueImageIds,
  sanitizeImageSource,
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

  it('asigna créditos individuales y de respaldo en las imágenes de plaga', () => {
    expect(sanitizeImageSource('  Dr. Roberto Mendoza  ')).toBe(
      'Dr. Roberto Mendoza',
    );
    expect(sanitizeImageSource('')).toBeNull();
    expect(sanitizeImageSource(null)).toBeNull();

    const records = buildPlagueImageRecords({
      plagueId: 10,
      files: [{ filename: 'foto1.png' }, { filename: 'foto2.jpg' }],
      startOrder: 0,
      sources: ['Autor Particular', ''],
      defaultSource: 'INIFAP Campo Experimental',
    });

    expect(records).toEqual([
      {
        plague_id: 10,
        url: 'images/plagues/foto1.png',
        sort_order: 0,
        source: 'Autor Particular',
      },
      {
        plague_id: 10,
        url: 'images/plagues/foto2.jpg',
        sort_order: 1,
        source: 'INIFAP Campo Experimental',
      },
    ]);

    const updates = buildExistingPlagueImageSourceUpdates({
      existingImages: [
        { id: 1, source: null },
        { id: 2, source: null },
      ],
      removedImageIds: [2],
      rawIds: ['1', '2', '999'],
      rawSources: ['Fotógrafo A', 'Fotógrafo B', 'Fotógrafo C'],
      defaultSource: 'INIFAP',
    });

    expect(updates).toEqual([{ id: 1, source: 'Fotógrafo A' }]);
  });
});
