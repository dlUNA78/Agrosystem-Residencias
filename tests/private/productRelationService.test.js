import { describe, expect, it } from '@jest/globals';

import { validateProductRelationsInput } from '../../src/services/productRelationService.js';

describe('validación de relaciones de productos', () => {
  it('normaliza selecciones únicas de cultivos y plagas', () => {
    const result = validateProductRelationsInput({
      crop_ids: ['7', '7', '12'],
      plague_ids: '4',
    });

    expect(result).toEqual({
      isValid: true,
      errors: [],
      value: { cropIds: [7, 12], plagueIds: [4] },
    });
  });

  it('acepta una selección vacía', () => {
    expect(validateProductRelationsInput({}).value).toEqual({
      cropIds: [],
      plagueIds: [],
    });
  });

  it('rechaza identificadores manipulados', () => {
    const result = validateProductRelationsInput({
      crop_ids: ['1', 'no-valido'],
      plague_ids: '-3',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});
