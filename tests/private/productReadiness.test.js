import { describe, expect, it } from '@jest/globals';

import {
  buildProductPublicationReadiness,
  requiresProductReadiness,
} from '../../src/services/productReadinessService.js';

const completeProduct = {
  name: 'Producto QA',
  category: 'Fungicida',
  active_ingredient: 'Cobre',
  registration_code: 'RSCO-QA-1',
  manufacturer: 'Laboratorio QA',
  description: 'Descripción técnica.',
  mode_of_action: 'Contacto',
  suggested_dosage: '1 L/ha',
  safety_interval_days: 7,
  images: [{ id: 1 }],
};

describe('requisitos editoriales de productos', () => {
  it('considera lista una ficha completa (incluyendo 0 días de seguridad)', () => {
    expect(buildProductPublicationReadiness(completeProduct).isReady).toBe(
      true,
    );
    expect(
      buildProductPublicationReadiness({
        ...completeProduct,
        safety_interval_days: 0,
      }).isReady,
    ).toBe(true);
  });

  it('explica los requisitos faltantes incluyendo intervalo de seguridad nulo', () => {
    const result = buildProductPublicationReadiness({});
    expect(result.isReady).toBe(false);
    expect(result.missingItems).toEqual(
      expect.arrayContaining([
        'Identificación comercial',
        'Registro oficial',
        'Intervalo de seguridad',
        'Evidencia fotográfica',
      ]),
    );
  });

  it.each(['submit_review', 'verify', 'publish'])(
    'exige completitud para %s',
    (action) => expect(requiresProductReadiness(action)).toBe(true),
  );
});
