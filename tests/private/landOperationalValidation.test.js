import { describe, expect, it } from '@jest/globals';

import {
  validateFarmApplicationInput,
  validateFarmCropInput,
  validateFarmHealthReportInput,
  validateStageAdvanceInput,
} from '../../src/services/landOperationalValidationService.js';

describe('validación del expediente operativo de terrenos', () => {
  it('normaliza un ciclo de cultivo válido', () => {
    const result = validateFarmCropInput({
      crop_id: '8',
      planting_date: '2026-03-15',
      area_section: ' Lote Norte ',
    });

    expect(result).toEqual({
      isValid: true,
      errors: [],
      fieldErrors: {},
      value: {
        crop_id: 8,
        planting_date: '2026-03-15',
        area_section: 'Lote Norte',
      },
    });
  });

  it('rechaza cultivos, fechas y secciones manipuladas', () => {
    const result = validateFarmCropInput({
      crop_id: 'otro',
      planting_date: '2026-02-31',
      area_section: 'x'.repeat(101),
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        crop_id: expect.any(Array),
        planting_date: expect.any(Array),
        area_section: expect.any(Array),
      }),
    );
  });

  it('valida el avance de una etapa concreta', () => {
    expect(
      validateStageAdvanceInput({
        farm_crop_id: '22',
        stage_order: '2',
        notes: 'Germinación confirmada',
      }).value,
    ).toEqual({
      farm_crop_id: 22,
      stage_order: 2,
      notes: 'Germinación confirmada',
    });
    expect(
      validateStageAdvanceInput({ farm_crop_id: 'x', stage_order: '9' })
        .isValid,
    ).toBe(false);
  });

  it('valida hallazgos vinculados a una plaga del catálogo', () => {
    const result = validateFarmHealthReportInput({
      plague_id: '4',
      farm_crop_id: '22',
      severity: 'high',
      description: 'Daño visible en hojas nuevas.',
      observed_at: '2026-09-06',
    });

    expect(result.isValid).toBe(true);
    expect(result.value).toEqual(
      expect.objectContaining({ plague_id: 4, severity: 'high' }),
    );
  });

  it('rechaza severidad, fecha y texto excesivo en hallazgos', () => {
    const result = validateFarmHealthReportInput({
      plague_id: '4',
      severity: 'critical',
      description: 'x'.repeat(2001),
      observed_at: 'mañana',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        severity: expect.any(Array),
        description: expect.any(Array),
        observed_at: expect.any(Array),
      }),
    );
  });

  it('normaliza una aplicación de producto con dosis acotada', () => {
    const result = validateFarmApplicationInput({
      product_id: '15',
      farm_crop_id: '22',
      dose_value: '1.500',
      dose_unit: 'L/ha',
      applied_at: '2026-09-06',
      notes: ' Aplicación matutina ',
    });

    expect(result.isValid).toBe(true);
    expect(result.value).toEqual(
      expect.objectContaining({
        product_id: 15,
        dose_value: 1.5,
        dose_unit: 'L/ha',
      }),
    );
  });

  it('rechaza unidades y dosis inventadas', () => {
    const result = validateFarmApplicationInput({
      product_id: '15',
      dose_value: '9999999999',
      dose_unit: 'cubetas',
      applied_at: '2026-09-06',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual(
      expect.objectContaining({
        dose_value: expect.any(Array),
        dose_unit: expect.any(Array),
      }),
    );
  });
});
