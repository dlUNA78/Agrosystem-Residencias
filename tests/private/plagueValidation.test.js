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

  it('construye etapas estructuradas desde los bloques interactivos', () => {
    const result = validatePlagueInput({
      name: 'Plaga por etapas',
      scientific_name: 'Gradus interactiva',
      biological_cycle_title: ['Huevo', 'Larva'],
      biological_cycle_description: [
        'Oviposición sobre el follaje',
        'Periodo de alimentación',
      ],
      biological_cycle_duration: ['3 días', '12 días'],
    });

    expect(result.isValid).toBe(true);
    expect(result.value.biological_cycle).toEqual([
      {
        title: 'Huevo',
        description: 'Oviposición sobre el follaje',
        duration: '3 días',
      },
      {
        title: 'Larva',
        description: 'Periodo de alimentación',
        duration: '12 días',
      },
    ]);
  });

  it('rechaza bloques sin título y campos de etapa demasiado extensos', () => {
    const result = validatePlagueInput({
      name: 'Plaga por etapas',
      scientific_name: 'Gradus invalida',
      biological_cycle_title: ['', 'x'.repeat(151)],
      biological_cycle_description: ['Descripción sin título', ''],
      biological_cycle_duration: ['', 'y'.repeat(101)],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('título'),
        expect.stringContaining('150 caracteres'),
        expect.stringContaining('100 caracteres'),
      ]),
    );
  });
});
