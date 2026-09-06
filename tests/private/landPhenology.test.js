import { describe, expect, it } from '@jest/globals';

import {
  generateLandCropStages,
  summarizeLandCropStages,
} from '../../src/services/landPhenologyService.js';

describe('etapas de cultivo en terrenos', () => {
  it('genera cinco etapas ordenadas desde la fecha de siembra', () => {
    const stages = generateLandCropStages('2026-01-15', 120);

    expect(stages).toHaveLength(5);
    expect(stages[0]).toEqual(
      expect.objectContaining({
        stage_order: 1,
        stage_name: 'Siembra / Trasplante',
        estimated_date: '2026-01-15',
        actual_date: '2026-01-15',
        status: 'completed',
      }),
    );
    expect(stages[1].status).toBe('in_progress');
    expect(stages[4].estimated_date).toBe('2026-05-15');
  });

  it('rechaza fechas y duraciones inválidas', () => {
    expect(() => generateLandCropStages('fecha-inválida', 120)).toThrow(
      /fecha de siembra/i,
    );
    expect(() => generateLandCropStages('2026-01-15', 0)).toThrow(
      /duración/i,
    );
  });

  it('resume progreso y etapa actual', () => {
    const stages = generateLandCropStages('2026-01-15', 100);
    const summary = summarizeLandCropStages(stages);

    expect(summary.progressPercent).toBe(20);
    expect(summary.currentStage.stage_order).toBe(2);
    expect(summary.stages[0].isCompleted).toBe(true);
  });
});
