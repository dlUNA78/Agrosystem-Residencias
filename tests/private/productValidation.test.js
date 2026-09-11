import { describe, expect, it } from '@jest/globals';

import { validateProductInput } from '../../src/services/productValidationService.js';

const validProduct = {
  name: 'Producto de prueba',
  category: 'Fungicida',
  active_ingredient: 'Ingrediente activo 20%',
  registration_code: 'RSCO-TEST-001',
  manufacturer: 'Laboratorio agrícola',
  safety_interval_days: '7',
  safety_sheet_url: 'https://example.com/ficha.pdf',
};

describe('validación de productos', () => {
  it('normaliza un producto válido y descarta campos de privilegio', () => {
    const result = validateProductInput({
      ...validProduct,
      workflow_status: 'published',
      validation_status: 'Aprobado',
      created_by_user_id: 999,
      status: false,
    });

    expect(result.isValid).toBe(true);
    expect(result.value.safety_interval_days).toBe(7);
    expect(result.value).not.toHaveProperty('workflow_status');
    expect(result.value).not.toHaveProperty('validation_status');
    expect(result.value).not.toHaveProperty('created_by_user_id');
    expect(result.value).not.toHaveProperty('status');
  });

  it('rechaza categoría, intervalo y URL fuera del contrato', () => {
    const result = validateProductInput({
      ...validProduct,
      category: 'Inventada',
      safety_interval_days: '999999',
      safety_sheet_url: 'javascript:alert(1)',
      hazard_category: 'Categoría inventada',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toHaveProperty('category');
    expect(result.fieldErrors).toHaveProperty('safety_interval_days');
    expect(result.fieldErrors).toHaveProperty('safety_sheet_url');
    expect(result.fieldErrors).toHaveProperty('hazard_category');
  });

  it('rechaza fechas de calendario inexistentes', () => {
    const result = validateProductInput({
      ...validProduct,
      expiration_date: '2026-02-31',
    });

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toHaveProperty('expiration_date');
  });
});
