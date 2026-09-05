import { describe, expect, it } from '@jest/globals';

import {
  buildCropPublicationReadiness,
  requiresCropReadiness,
} from '../../src/services/cropReadinessService.js';

const completeCrop = {
  name: 'Maíz',
  scientific_name: 'Zea mays',
  category: 'Granos y Cereales',
  description: 'Descripción técnica del cultivo.',
  region: 'El Bajío',
  optimal_climate: 'Templado a cálido',
  soil_requirements: 'Suelo franco con buen drenaje',
  growth_cycle: '120 a 150 días',
  planting_season: 'Primavera-Verano',
  water_requirements: '500 a 800 mm',
  images: [{ id: 1 }],
};

describe('requisitos editoriales de cultivos', () => {
  it('considera lista una ficha técnica completa', () => {
    const readiness = buildCropPublicationReadiness(completeCrop);

    expect(readiness.isReady).toBe(true);
    expect(readiness.completeCount).toBe(readiness.totalCount);
    expect(readiness.missingItems).toEqual([]);
  });

  it('explica todos los bloques faltantes', () => {
    const readiness = buildCropPublicationReadiness({});

    expect(readiness.isReady).toBe(false);
    expect(readiness.missingItems).toEqual(
      expect.arrayContaining([
        'Identificación taxonómica',
        'Clasificación',
        'Descripción técnica',
        'Región productiva',
        'Condiciones climáticas',
        'Requisitos de suelo',
        'Ciclo agrícola',
        'Requerimiento hídrico',
        'Evidencia fotográfica',
      ]),
    );
  });

  it('acepta los campos modernos o los campos agronómicos heredados', () => {
    const readiness = buildCropPublicationReadiness(
      {
        ...completeCrop,
        optimal_climate: null,
        soil_requirements: null,
        growth_cycle: null,
        planting_season: null,
        water_requirements: null,
        climate: 'Templado',
        soil_type: 'Franco',
        cycle: 'Anual',
        season: 'Primavera',
        water_requirement: 'Medio',
        images: [],
      },
      { imageCount: 1 },
    );

    expect(readiness.isReady).toBe(true);
  });

  it.each(['submit_review', 'verify', 'publish'])(
    'exige completitud para %s',
    (action) => {
      expect(requiresCropReadiness(action)).toBe(true);
    },
  );

  it.each(['request_changes', 'archive', 'restore', 'unknown'])(
    'no exige completitud para %s',
    (action) => {
      expect(requiresCropReadiness(action)).toBe(false);
    },
  );
});
