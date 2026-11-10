import { describe, expect, it } from '@jest/globals';

import {
  buildExistingProductImageSourceUpdates,
  buildProductImageRecords,
  buildProductImageUpdatePlan,
  parsePrimaryProductImageId,
  parseRemovedProductImageIds,
  sanitizeImageSource,
} from '../../src/services/productImageService.js';

describe('servicio de galería de productos', () => {
  it('parsea IDs de imágenes a eliminar y rechaza formatos inválidos', () => {
    expect(parseRemovedProductImageIds('')).toEqual([]);
    expect(parseRemovedProductImageIds('4, 9, 4')).toEqual([4, 9]);
    expect(parseRemovedProductImageIds(['2', '7'])).toEqual([2, 7]);
    expect(parseRemovedProductImageIds('4,abc')).toBeNull();
    expect(parseRemovedProductImageIds('-1')).toBeNull();
  });

  it('parsea ID de imagen principal de forma segura', () => {
    expect(parsePrimaryProductImageId('')).toBeNull();
    expect(parsePrimaryProductImageId('15')).toBe(15);
    expect(parsePrimaryProductImageId('0')).toBeNull();
    expect(parsePrimaryProductImageId('15;DROP')).toBeNull();
  });

  it('calcula plan de actualización reasignando portada y respetando límite de 10 imágenes', () => {
    const existingImages = [
      {
        id: 10,
        image_url: 'images/products/a.png',
        is_primary: true,
        display_order: 0,
      },
      {
        id: 11,
        image_url: 'images/products/b.png',
        is_primary: false,
        display_order: 1,
      },
      {
        id: 12,
        image_url: 'images/products/c.png',
        is_primary: false,
        display_order: 2,
      },
    ];

    const plan = buildProductImageUpdatePlan({
      existingImages,
      removedImageIds: [10],
      newFileCount: 2,
      primaryImageId: 12,
    });

    expect(plan.error).toBeUndefined();
    expect(plan.removedImages).toHaveLength(1);
    expect(plan.remainingImages.map((img) => img.id)).toEqual([11, 12]);
    expect(plan.nextPrimaryId).toBe(12);
    expect(plan.hasPrimary).toBe(true);
    expect(plan.nextImageOrder).toBe(3);
  });

  it('rechaza IDs ajenos o exceso sobre 10 fotografías', () => {
    const existingImages = Array.from({ length: 8 }, (_, idx) => ({
      id: idx + 1,
      image_url: `images/products/${idx + 1}.png`,
      is_primary: idx === 0,
      display_order: idx,
    }));

    expect(
      buildProductImageUpdatePlan({
        existingImages,
        removedImageIds: [999],
        newFileCount: 0,
      }).error,
    ).toMatch(/no es válida/i);

    expect(
      buildProductImageUpdatePlan({
        existingImages,
        removedImageIds: [],
        newFileCount: 3,
      }).error,
    ).toMatch(/máximo 10/i);
  });

  it('procesa créditos asignados y fuentes predeterminadas en productos', () => {
    expect(sanitizeImageSource('  Etiqueta Oficial  ')).toBe(
      'Etiqueta Oficial',
    );

    const records = buildProductImageRecords({
      productId: 50,
      files: [{ filename: 'p1.png', originalname: 'p1.png' }],
      startOrder: 0,
      hasPrimary: true,
      sources: ['Envase comercial'],
      defaultSource: null,
    });

    expect(records[0].source).toBe('Envase comercial');

    const updates = buildExistingProductImageSourceUpdates({
      existingImages: [{ id: 4, source: null }],
      removedImageIds: [],
      rawIds: ['4'],
      rawSources: [''],
      defaultSource: 'Archivo INIFAP',
    });

    expect(updates).toEqual([{ id: 4, source: 'Archivo INIFAP' }]);
  });
});
