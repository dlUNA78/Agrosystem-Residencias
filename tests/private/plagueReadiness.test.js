import { describe, expect, it } from '@jest/globals';

import {
  buildPlaguePublicationReadiness,
  requiresPlagueReadiness,
} from '../../src/services/plagueReadinessService.js';

const completePlague = {
  name: 'Gusano cogollero',
  scientific_name: 'Spodoptera frugiperda',
  category: 'Insecto',
  risk_level: 'Alto',
  description: 'Descripción técnica completa.',
  symptoms: 'Daño foliar y presencia de larvas.',
  control_methods: 'Monitoreo y manejo integrado.',
  biological_cycle: [{ title: 'Larva', duration: '14 días' }],
  images: [{ id: 1 }],
  crops: [{ id: 8 }],
  regions: [{ id: 3 }],
};

describe('checklist de publicación de plagas', () => {
  it('marca lista una ficha con la evidencia técnica mínima', () => {
    const readiness = buildPlaguePublicationReadiness(completePlague);

    expect(readiness.isReady).toBe(true);
    expect(readiness.completeCount).toBe(readiness.totalCount);
    expect(readiness.missingItems).toEqual([]);
    expect(readiness.items).toHaveLength(9);
  });

  it('explica los requisitos faltantes sin exigir un producto químico', () => {
    const readiness = buildPlaguePublicationReadiness({
      name: 'Registro incompleto',
      scientific_name: 'Species incompleta',
      category: 'Hongo',
      risk_level: 'Medio',
      description: 'Descripción disponible',
      biological_control: 'Control biológico disponible',
      biological_cycle: JSON.stringify({ espora: '5 días' }),
      images: [{ id: 1 }],
      crops: [],
      regions: [],
    });

    expect(readiness.isReady).toBe(false);
    expect(readiness.missingItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Síntomas'),
        expect.stringMatching(/cultivo/i),
        expect.stringMatching(/región/i),
      ]),
    );
    expect(readiness.missingItems.join(' ')).not.toMatch(/producto/i);
  });

  it('acepta conteos obtenidos dentro de la transacción del workflow', () => {
    const readiness = buildPlaguePublicationReadiness(
      { ...completePlague, images: [], crops: [], regions: [] },
      { imageCount: 2, cropCount: 1, regionCount: 3 },
    );

    expect(readiness.isReady).toBe(true);
  });

  it.each(['submit_review', 'verify', 'publish'])(
    'exige checklist para la acción %s',
    (action) => {
      expect(requiresPlagueReadiness(action)).toBe(true);
    },
  );

  it.each(['request_changes', 'archive', 'restore', 'unknown'])(
    'no bloquea con checklist la acción %s',
    (action) => {
      expect(requiresPlagueReadiness(action)).toBe(false);
    },
  );
});
