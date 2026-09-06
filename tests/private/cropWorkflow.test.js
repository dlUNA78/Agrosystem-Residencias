import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import {
  CROP_WORKFLOW_ACTIONS,
  CROP_WORKFLOW_STATUSES,
  CropWorkflowError,
  isCropEditable,
  transitionCropWorkflow,
} from '../../src/services/cropWorkflowService.js';

describe('workflow editorial de cultivos', () => {
  const actor = { id: 27, role: 'inifap' };
  const now = new Date('2026-09-03T12:00:00.000Z');

  it.each([
    ['draft', 'submit_review', 'in_review'],
    ['changes_requested', 'submit_review', 'in_review'],
    ['in_review', 'request_changes', 'changes_requested'],
    ['in_review', 'verify', 'verified'],
    ['verified', 'publish', 'published'],
    ['published', 'archive', 'archived'],
    ['archived', 'restore', 'draft'],
  ])('permite la transición %s → %s → %s', (current, action, expected) => {
    const changes = transitionCropWorkflow({
      currentStatus: current,
      action,
      actor,
      now,
      reviewNotes: 'Revisión técnica',
    });

    expect(changes.workflow_status).toBe(expected);
  });

  it('mantiene el cultivo fuera del área pública al verificar', () => {
    const changes = transitionCropWorkflow({
      currentStatus: CROP_WORKFLOW_STATUSES.IN_REVIEW,
      action: CROP_WORKFLOW_ACTIONS.VERIFY,
      actor,
      now,
    });

    expect(changes).toEqual(
      expect.objectContaining({
        workflow_status: CROP_WORKFLOW_STATUSES.VERIFIED,
        verified_by_user_id: 27,
        verified_at: now,
        status: 'pendiente',
      }),
    );
  });

  it('sólo habilita la visibilidad pública al publicar', () => {
    const changes = transitionCropWorkflow({
      currentStatus: CROP_WORKFLOW_STATUSES.VERIFIED,
      action: CROP_WORKFLOW_ACTIONS.PUBLISH,
      actor: { id: 1, role: 'admin' },
      now,
    });

    expect(changes).toEqual(
      expect.objectContaining({
        workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
        published_by_user_id: 1,
        published_at: now,
        status: 'aprobado',
      }),
    );
  });

  it('rechaza saltos de estado y acciones desconocidas', () => {
    expect(() =>
      transitionCropWorkflow({
        currentStatus: CROP_WORKFLOW_STATUSES.DRAFT,
        action: CROP_WORKFLOW_ACTIONS.PUBLISH,
        actor,
      }),
    ).toThrow(CropWorkflowError);
  });

  it('exige observaciones al solicitar cambios', () => {
    expect(() =>
      transitionCropWorkflow({
        currentStatus: CROP_WORKFLOW_STATUSES.IN_REVIEW,
        action: CROP_WORKFLOW_ACTIONS.REQUEST_CHANGES,
        actor,
      }),
    ).toThrow(/observaciones/i);
  });

  it('limita las observaciones de revisión a 500 caracteres', () => {
    expect(() =>
      transitionCropWorkflow({
        currentStatus: CROP_WORKFLOW_STATUSES.IN_REVIEW,
        action: CROP_WORKFLOW_ACTIONS.REQUEST_CHANGES,
        actor,
        reviewNotes: 'x'.repeat(501),
      }),
    ).toThrow(/500 caracteres/i);
  });

  it('sólo permite editar borradores o registros con cambios solicitados', () => {
    expect(isCropEditable(CROP_WORKFLOW_STATUSES.DRAFT)).toBe(true);
    expect(isCropEditable(CROP_WORKFLOW_STATUSES.CHANGES_REQUESTED)).toBe(true);
    expect(isCropEditable(CROP_WORKFLOW_STATUSES.IN_REVIEW)).toBe(false);
    expect(isCropEditable(CROP_WORKFLOW_STATUSES.VERIFIED)).toBe(false);
    expect(isCropEditable(CROP_WORKFLOW_STATUSES.PUBLISHED)).toBe(false);
  });

  it('limpia aprobaciones y visibilidad cuando restaura un registro', () => {
    const changes = transitionCropWorkflow({
      currentStatus: CROP_WORKFLOW_STATUSES.ARCHIVED,
      action: CROP_WORKFLOW_ACTIONS.RESTORE,
      actor: { id: 1, role: 'admin' },
      now,
    });

    expect(changes).toEqual(
      expect.objectContaining({
        workflow_status: CROP_WORKFLOW_STATUSES.DRAFT,
        verified_by_user_id: null,
        verified_at: null,
        published_by_user_id: null,
        published_at: null,
        status: 'pendiente',
      }),
    );
  });

  it('incluye migración reversible y conserva publicados existentes', () => {
    const migration = fs.readFileSync(
      new URL(
        '../../src/migrations/20260903000001-add-crop-workflow.js',
        import.meta.url,
      ),
      'utf8',
    );

    expect(migration).toMatch(/addColumn\(\s*'Crops',\s*'workflow_status'/);
    expect(migration).toMatch(/status[^\n]+aprobado[^\n]+published/i);
    expect(migration).toMatch(/removeColumn\(\s*'Crops',\s*'workflow_status'/);
  });
});
