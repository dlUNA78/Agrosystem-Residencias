import { describe, expect, it } from '@jest/globals';

import { validatePlagueInput } from '../../src/services/plagueValidationService.js';

describe('validación de entradas de plagas', () => {
  it('normaliza campos válidos y convierte el ciclo biológico en etapas', () => {
    const result = validatePlagueInput({
      name: '  Gusano cogollero  ',
      scientific_name: ' Spodoptera frugiperda ',
      category: 'Insecto',
      risk_level: 'Alto',
      biological_cycle: 'Huevo\nLarva\n\nAdulto',
      description: ' Registro técnico ',
    });

    expect(result.isValid).toBe(true);
    expect(result.value).toEqual(
      expect.objectContaining({
        name: 'Gusano cogollero',
        scientific_name: 'Spodoptera frugiperda',
        biological_cycle: ['Huevo', 'Larva', 'Adulto'],
        description: 'Registro técnico',
      }),
    );
  });

  it('rechaza nombres obligatorios, categorías y riesgos no permitidos', () => {
    const result = validatePlagueInput({
      name: ' ',
      scientific_name: '',
      category: '<script>alert(1)</script>',
      risk_level: 'Extremo inventado',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('nombre común'),
        expect.stringContaining('nombre científico'),
        expect.stringContaining('categoría'),
        expect.stringContaining('riesgo'),
      ]),
    );
  });

  it('limita tamaño y número de etapas antes de llegar a Sequelize', () => {
    const result = validatePlagueInput({
      name: 'Plaga válida',
      scientific_name: 'Species validus',
      description: 'x'.repeat(5001),
      biological_cycle: Array.from(
        { length: 21 },
        (_, index) => `Etapa ${index}`,
      ).join('\n'),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('descripción'),
        expect.stringContaining('20 etapas'),
      ]),
    );
  });
});
