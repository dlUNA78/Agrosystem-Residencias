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

  it('avanza etapas automáticamente si la fecha de referencia es posterior a la siembra', () => {
    // Siembra el 2026-01-01 con 100 días.
    // Etapa 1: 2026-01-01
    // Etapa 2: 2026-01-16 (15%)
    // Etapa 3: 2026-02-10 (40%)
    // Etapa 4: 2026-03-17 (75%)
    // Etapa 5: 2026-04-11 (100%)
    const stages = generateLandCropStages('2026-01-01', 100, '2026-02-15');

    expect(stages[0].status).toBe('completed');
    expect(stages[1].status).toBe('completed');
    expect(stages[2].status).toBe('completed');
    expect(stages[3].status).toBe('in_progress');
    expect(stages[4].status).toBe('pending');
  });

  it('rechaza fechas y duraciones inválidas', () => {
    expect(() => generateLandCropStages('fecha-inválida', 120)).toThrow(
      /fecha de siembra/i,
    );
    expect(() => generateLandCropStages('2026-01-15', 0)).toThrow(/duración/i);
  });

  it('resume progreso y etapa actual', () => {
    const stages = generateLandCropStages('2026-01-15', 100);
    const summary = summarizeLandCropStages(stages);

    expect(summary.progressPercent).toBe(20);
    expect(summary.currentStage.stage_order).toBe(2);
    expect(summary.stages[0].isCompleted).toBe(true);
    expect(summary.estimatedHarvestDate).toBe('2026-04-25');
    expect(summary.harvestDays).toBe(100);
  });

  it('calcula progreso temporal dinámico con useTimeProgress', () => {
    const stages = generateLandCropStages('2026-01-01', 100);
    const summary = summarizeLandCropStages(stages, {
      useTimeProgress: true,
      today: '2026-02-20', // 50 días transcurridos de 100
    });

    expect(summary.progressPercent).toBe(50);
    expect(summary.elapsedDays).toBe(50);
  });

  it('marca progreso 100% en ciclos finalizados o archivados', () => {
    const stages = generateLandCropStages('2026-01-01', 100);
    const summary = summarizeLandCropStages(stages, {
      useTimeProgress: true,
      isCycleActive: false,
      cycleStatus: 'archived',
    });

    expect(summary.progressPercent).toBe(100);
    expect(summary.stages.every((s) => s.isCompleted)).toBe(true);
  });
});
