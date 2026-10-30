import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildCropImageRecords,
  buildCropImageUpdatePlan,
  cleanupStoredCropImages,
  MAX_CROP_IMAGES,
  parsePrimaryCropImageId,
  parseRemovedCropImageIds,
} from '../../src/services/cropImageService.js';

describe('reglas de la galería fotográfica de cultivos', () => {
  it('mantiene el límite normativo de 10 imágenes', () => {
    expect(MAX_CROP_IMAGES).toBe(10);
  });

  it('normaliza y elimina duplicados de los IDs a quitar', () => {
    expect(parseRemovedCropImageIds(['5', '9', '5'])).toEqual([5, 9]);
    expect(parseRemovedCropImageIds('5, 9,5')).toEqual([5, 9]);
    expect(parseRemovedCropImageIds(undefined)).toEqual([]);
    expect(parseRemovedCropImageIds('')).toEqual([]);
  });

  it.each(['0', '-3', 'abc', '1.2', ['4', 'invalido']])(
    'rechaza una selección de IDs inválida o manipulada: %p',
    (value) => {
      expect(parseRemovedCropImageIds(value)).toBeNull();
    },
  );

  it('valida el selector de imagen principal', () => {
    expect(parsePrimaryCropImageId('12')).toBe(12);
    expect(parsePrimaryCropImageId(4)).toBe(4);
    expect(parsePrimaryCropImageId('')).toBeNull();
    expect(parsePrimaryCropImageId(undefined)).toBeNull();
    expect(parsePrimaryCropImageId('invalido')).toBeNull();
    expect(parsePrimaryCropImageId('-5')).toBeNull();
  });

  it('construye registros de imagen con asignación de orden y marca primaria', () => {
    const records = buildCropImageRecords({
      cropId: 101,
      files: [
        { filename: 'cultivo-1.webp', originalname: 'Maiz 1.webp' },
        { filename: 'cultivo-2.webp', originalname: 'Maiz 2.webp' },
      ],
      startOrder: 3,
      hasPrimary: false,
    });

    expect(records).toEqual([
      {
        crop_id: 101,
        image_url: 'images/crops/cultivo-1.webp',
        original_name: 'Maiz 1.webp',
        is_primary: true,
        display_order: 3,
      },
      {
        crop_id: 101,
        image_url: 'images/crops/cultivo-2.webp',
        original_name: 'Maiz 2.webp',
        is_primary: false,
        display_order: 4,
      },
    ]);
  });

  it('calcula plan de actualización de imágenes con límite y selección de principal', () => {
    const existingImages = [
      { id: 1, is_primary: true, display_order: 0 },
      { id: 2, is_primary: false, display_order: 1 },
      { id: 3, is_primary: false, display_order: 2 },
    ];

    const plan = buildCropImageUpdatePlan({
      existingImages,
      removedImageIds: [1],
      newFileCount: 2,
      primaryImageId: 3,
    });

    expect(plan.error).toBeNull();
    expect(plan.removedImages).toHaveLength(1);
    expect(plan.removedImages[0].id).toBe(1);
    expect(plan.remainingImages).toHaveLength(2);
    expect(plan.nextPrimaryId).toBe(3);
    expect(plan.hasRemainingPrimary).toBe(true);
    expect(plan.nextImageOrder).toBe(3);
  });

  it('rechaza agregar más de 10 imágenes sumando remanentes y nuevas', () => {
    const existingImages = Array.from({ length: 9 }, (_, index) => ({
      id: index + 1,
      is_primary: index === 0,
      display_order: index,
    }));

    const plan = buildCropImageUpdatePlan({
      existingImages,
      removedImageIds: [],
      newFileCount: 2,
    });

    expect(plan.error).toMatch(/máximo 10 imágenes/i);
  });

  it('rechaza IDs de eliminación que no corresponden al cultivo', () => {
    const existingImages = [{ id: 10, is_primary: true, display_order: 0 }];
    const plan = buildCropImageUpdatePlan({
      existingImages,
      removedImageIds: [999],
      newFileCount: 0,
    });

    expect(plan.error).toMatch(/no es válida/i);
  });

  it('limpia únicamente archivos pertenecientes a public/images/crops', async () => {
    const cropsDir = path.resolve('public/images/crops');
    fs.mkdirSync(cropsDir, { recursive: true });
    const cropFileName = `crop-test-${Date.now()}.png`;
    const cropFile = path.join(cropsDir, cropFileName);
    const externalDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'crop-clean-test-'),
    );
    const externalFile = path.join(externalDir, 'protect.png');

    fs.writeFileSync(cropFile, 'crop data');
    fs.writeFileSync(externalFile, 'do not delete');

    try {
      await cleanupStoredCropImages([
        { image_url: `images/crops/${cropFileName}` },
        { image_url: `../${externalFile}` },
      ]);

      expect(fs.existsSync(cropFile)).toBe(false);
      expect(fs.existsSync(externalFile)).toBe(true);
    } finally {
      fs.rmSync(cropFile, { force: true });
      fs.rmSync(externalDir, { recursive: true, force: true });
    }
  });
});
