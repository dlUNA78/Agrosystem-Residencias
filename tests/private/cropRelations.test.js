import { describe, expect, it } from '@jest/globals';

import {
  buildCropRelationEditor,
  validateCropRelationsInput,
} from '../../src/services/cropRelationService.js';

describe('cropRelationService - Validación y edición de relaciones de cultivos', () => {
  describe('validateCropRelationsInput', () => {
    it('valida listas de IDs válidas y deduplica', () => {
      const result = validateCropRelationsInput({
        plague_ids: ['1', '2', '2'],
        product_ids: '5',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.value.plagueIds).toEqual([1, 2]);
      expect(result.value.productIds).toEqual([5]);
    });

    it('detecta identificadores no numéricos o inválidos', () => {
      const result = validateCropRelationsInput({
        plague_ids: ['abc', '-1'],
        product_ids: ['0'],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('acepta arrays vacíos o nulos sin error', () => {
      const result = validateCropRelationsInput({});
      expect(result.isValid).toBe(true);
      expect(result.value.plagueIds).toEqual([]);
      expect(result.value.productIds).toEqual([]);
    });
  });

  describe('buildCropRelationEditor', () => {
    it('marca correctamente elementos seleccionados vs no seleccionados', () => {
      const allPlagues = [
        { id: 1, name: 'Gusano cogollero', category: 'Lepidóptero' },
        { id: 2, name: 'Pulgón verde', category: 'Hemíptero' },
      ];
      const allProducts = [
        { id: 10, name: 'Bio-Insecticida', active_ingredient: 'BT' },
        { id: 20, name: 'Cobre Fungicida', active_ingredient: 'Cobre' },
      ];

      const editor = buildCropRelationEditor({
        plagues: allPlagues,
        products: allProducts,
        selectedPlagues: [{ id: 1 }],
        selectedProducts: [{ id: 20 }],
      });

      expect(editor.plagues[0].selected).toBe(true);
      expect(editor.plagues[1].selected).toBe(false);
      expect(editor.products[0].selected).toBe(false);
      expect(editor.products[1].selected).toBe(true);
      expect(editor.selectedPlaguesCount).toBe(1);
      expect(editor.selectedProductsCount).toBe(1);
    });
  });
});
