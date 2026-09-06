import { describe, expect, it } from '@jest/globals';

import { validateCropInput } from '../../src/services/cropValidationService.js';

describe('validación de entradas de cultivos', () => {
  it('exige la identidad básica y la región principal', () => {
    const result = validateCropInput({});

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/nombre común/i);
    expect(result.errors.join(' ')).toMatch(/nombre científico/i);
    expect(result.errors.join(' ')).toMatch(/categoría/i);
    expect(result.errors.join(' ')).toMatch(/región/i);
  });

  it('normaliza texto, números y booleanos permitidos', () => {
    const result = validateCropInput({
      name: '  Maíz\0 ',
      scientific_name: ' Zea mays ',
      category: 'Granos y Cereales',
      region: 'centro',
      climate: 'Templado',
      soil_type: 'Franco',
      min_altitude: '100',
      max_altitude: '2500',
      min_temperature: '12.5',
      max_temperature: '30',
      harvest_days: '140',
      requires_pruning: 'false',
    });

    expect(result.isValid).toBe(true);
    expect(result.value).toEqual(
      expect.objectContaining({
        name: 'Maíz',
        scientific_name: 'Zea mays',
        region: 'centro',
        climate: 'templado',
        soil_type: 'franco',
        min_altitude: 100,
        max_altitude: 2500,
        min_temperature: 12.5,
        max_temperature: 30,
        harvest_days: 140,
        requires_pruning: false,
      }),
    );
  });

  it('rechaza categorías ajenas al catálogo', () => {
    const result = validateCropInput({
      name: 'Maíz',
      scientific_name: 'Zea mays',
      category: 'categoría-inventada',
      region: 'centro',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/categoría seleccionada/i);
  });

  it('rechaza números inválidos y rangos invertidos', () => {
    const result = validateCropInput({
      name: 'Maíz',
      scientific_name: 'Zea mays',
      category: 'Granos y Cereales',
      region: 'centro',
      min_altitude: '3000',
      max_altitude: '100',
      min_temperature: 'caliente',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/altitud mínima/i);
    expect(result.errors.join(' ')).toMatch(/temperatura mínima/i);
  });

  it('no permite persistir campos editoriales enviados por el navegador', () => {
    const result = validateCropInput({
      name: 'Maíz',
      scientific_name: 'Zea mays',
      category: 'Granos y Cereales',
      region: 'centro',
      status: 'aprobado',
      workflow_status: 'published',
      created_by_user_id: 999,
    });

    expect(result.value).not.toHaveProperty('status');
    expect(result.value).not.toHaveProperty('workflow_status');
    expect(result.value).not.toHaveProperty('created_by_user_id');
  });

  it('rechaza cifras agronómicas fuera de límites plausibles', () => {
    const result = validateCropInput({
      name: 'Maíz',
      scientific_name: 'Zea mays',
      category: 'Granos y Cereales',
      region: 'centro',
      max_altitude: '9000',
      max_temperature: '200',
      max_rainfall: '999999',
      harvest_days: '999999999999',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        max_altitude: expect.any(Array),
        max_temperature: expect.any(Array),
        max_rainfall: expect.any(Array),
        harvest_days: expect.any(Array),
      }),
    );
    expect(result.errors.join(' ')).toMatch(/3650/);
  });

  it('rechaza opciones manipuladas y formatos agronómicos inválidos', () => {
    const result = validateCropInput({
      name: 'Maíz',
      scientific_name: 'Zea mays 123',
      category: 'Granos y Cereales',
      region: 'region-inventada',
      climate: 'clima-inventado',
      ph_range: '20 - 3',
      planting_depth: 'profunda',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        scientific_name: expect.any(Array),
        region: expect.any(Array),
        climate: expect.any(Array),
        ph_range: expect.any(Array),
        planting_depth: expect.any(Array),
      }),
    );
  });
});
