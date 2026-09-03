import { describe, expect, it } from '@jest/globals';

import {
  PLAGUE_RELATION_RISK_LEVELS,
  buildPlagueRelationEditor,
  validatePlagueRelationsInput,
} from '../../src/services/plagueRelationService.js';

describe('relaciones técnicas de plagas', () => {
  it('normaliza selecciones escalares, elimina duplicados y conserva el riesgo regional', () => {
    const result = validatePlagueRelationsInput({
      product_ids: ['2', '2', '5'],
      crop_ids: '8',
      region_ids: ['3', '7'],
      region_risk_3: 'Alto',
      region_risk_7: 'Bajo',
    });

    expect(result).toEqual({
      isValid: true,
      errors: [],
      value: {
        productIds: [2, 5],
        cropIds: [8],
        regions: [
          { region_id: 3, risk_level: 'Alto' },
          { region_id: 7, risk_level: 'Bajo' },
        ],
      },
    });
  });

  it('rechaza identificadores manipulados y riesgos fuera del catálogo', () => {
    const result = validatePlagueRelationsInput({
      product_ids: ['1', 'abc'],
      crop_ids: '-9',
      region_ids: '4',
      region_risk_4: 'Extremo inventado',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('productos'),
        expect.stringContaining('cultivos'),
        expect.stringContaining('riesgo'),
      ]),
    );
  });

  it('permite limpiar todas las relaciones con un formulario vacío', () => {
    expect(validatePlagueRelationsInput({})).toEqual({
      isValid: true,
      errors: [],
      value: { productIds: [], cropIds: [], regions: [] },
    });
  });

  it('prepara opciones marcadas para el formulario privado sin alterar los catálogos', () => {
    const editor = buildPlagueRelationEditor({
      products: [
        { id: 1, name: 'Producto A', active_ingredient: 'Ingrediente A' },
        { id: 2, name: 'Producto B' },
      ],
      crops: [{ id: 10, name: 'Maíz' }],
      regions: [
        { id: 20, name: 'Norte' },
        { id: 21, name: 'Sur' },
      ],
      selectedProducts: [{ id: 2 }],
      selectedCrops: [{ id: 10 }],
      selectedRegions: [{ id: 21, PlagueRegions: { risk_level: 'Medio' } }],
    });

    expect(editor.products).toEqual([
      expect.objectContaining({ id: 1, isSelected: false }),
      expect.objectContaining({ id: 2, isSelected: true }),
    ]);
    expect(editor.crops[0]).toEqual(
      expect.objectContaining({ id: 10, isSelected: true }),
    );
    expect(editor.regions[1]).toEqual(
      expect.objectContaining({
        id: 21,
        isSelected: true,
        selectedRisk: 'Medio',
      }),
    );
    expect(editor.riskLevels).toEqual(PLAGUE_RELATION_RISK_LEVELS);
  });
});
