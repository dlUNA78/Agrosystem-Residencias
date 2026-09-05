import { describe, expect, it } from '@jest/globals';

import { validateCropInput } from '../../src/services/cropValidationService.js';

describe('validación de entradas de cultivos', () => {
  it('exige nombre, nombre científico y categoría', () => {
    const result = validateCropInput({});

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/nombre común/i);
    expect(result.errors.join(' ')).toMatch(/nombre científico/i);
    expect(result.errors.join(' ')).toMatch(/categoría/i);
  });

  it('normaliza texto, números y booleanos permitidos', () => {
    const result = validateCropInput({
      name: '  Maíz\0 ',
      scientific_name: ' Zea mays ',
      category: 'Granos y Cereales',
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
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/categoría seleccionada/i);
  });

  it('rechaza números inválidos y rangos invertidos', () => {
    const result = validateCropInput({
      name: 'Maíz',
      scientific_name: 'Zea mays',
      category: 'Granos y Cereales',
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
      status: 'aprobado',
      workflow_status: 'published',
      created_by_user_id: 999,
    });

    expect(result.value).not.toHaveProperty('status');
    expect(result.value).not.toHaveProperty('workflow_status');
    expect(result.value).not.toHaveProperty('created_by_user_id');
  });
});
