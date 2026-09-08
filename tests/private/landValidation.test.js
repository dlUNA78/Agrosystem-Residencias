import { describe, expect, it } from '@jest/globals';

import {
  parseLandId,
  validateLandInput,
} from '../../src/services/landValidationService.js';

describe('validación de entradas de terrenos', () => {
  it('exige nombre y superficie', () => {
    const result = validateLandInput({});

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        name: expect.any(Array),
        size_hectares: expect.any(Array),
      }),
    );
  });

  it('normaliza exclusivamente los campos permitidos', () => {
    const result = validateLandInput({
      name: '  Parcela Norte\0 ',
      size_hectares: '5.25',
      farming_type: 'Riego',
      municipality: ' Uruapan ',
      region_id: '3',
      location_lat: '19.4326080',
      location_lng: '-99.1332090',
      user_id: '999',
      status: 'false',
    });

    expect(result.isValid).toBe(true);
    expect(result.value).toEqual({
      name: 'Parcela Norte',
      size_hectares: 5.25,
      farming_type: 'Riego',
      municipality: 'Uruapan',
      region_id: 3,
      location_lat: 19.432608,
      location_lng: -99.133209,
    });
    expect(result.value).not.toHaveProperty('user_id');
    expect(result.value).not.toHaveProperty('status');
  });

  it('rechaza superficie, catálogos y coordenadas manipuladas', () => {
    const result = validateLandInput({
      name: 'Parcela inválida',
      size_hectares: '999999999999',
      farming_type: 'Inventado',
      region_id: '-4',
      location_lat: '91',
      location_lng: '-181',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        size_hectares: expect.any(Array),
        farming_type: expect.any(Array),
        region_id: expect.any(Array),
        location_lat: expect.any(Array),
        location_lng: expect.any(Array),
      }),
    );
  });

  it('exige que latitud y longitud se proporcionen juntas', () => {
    const result = validateLandInput({
      name: 'Parcela Norte',
      size_hectares: '8',
      location_lat: '19.4',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/latitud y longitud/i);
  });

  it('acepta únicamente identificadores enteros positivos', () => {
    expect(parseLandId('18')).toBe(18);
    expect(parseLandId('0')).toBeNull();
    expect(parseLandId('3.5')).toBeNull();
    expect(parseLandId('abc')).toBeNull();
  });
});
