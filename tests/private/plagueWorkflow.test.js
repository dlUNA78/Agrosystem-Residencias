import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import {
  PLAGUE_WORKFLOW_ACTIONS,
  PLAGUE_WORKFLOW_STATUSES,
  PlagueWorkflowError,
  isPlagueEditable,
  transitionPlagueWorkflow,
} from '../../src/services/plagueWorkflowService.js';

describe('workflow editorial de plagas', () => {
  const actor = { id: 27, role: 'inifap' };
  const now = new Date('2026-08-31T12:00:00.000Z');

  it.each([
    ['draft', 'submit_review', 'in_review'],
    ['changes_requested', 'submit_review', 'in_review'],
    ['in_review', 'request_changes', 'changes_requested'],
    ['in_review', 'verify', 'verified'],
    ['verified', 'publish', 'published'],
    ['published', 'archive', 'archived'],
    ['archived', 'restore', 'draft'],
  ])('permite la transición %s → %s → %s', (current, action, expected) => {
    const changes = transitionPlagueWorkflow({
      currentStatus: current,
      action,
      actor,
      now,
      reviewNotes: 'Revisión técnica',
    });

    expect(changes.workflow_status).toBe(expected);
  });

  it('registra al verificador en servidor y mantiene la plaga fuera del área pública', () => {
    const changes = transitionPlagueWorkflow({
      currentStatus: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW,
      action: PLAGUE_WORKFLOW_ACTIONS.VERIFY,
      actor,
      now,
    });

    expect(changes).toEqual(
      expect.objectContaining({
        workflow_status: PLAGUE_WORKFLOW_STATUSES.VERIFIED,
        verified_by_user_id: 27,
        verified_at: now,
        status: false,
      }),
    );
  });

  it('sólo activa la visibilidad pública al publicar', () => {
    const changes = transitionPlagueWorkflow({
      currentStatus: PLAGUE_WORKFLOW_STATUSES.VERIFIED,
      action: PLAGUE_WORKFLOW_ACTIONS.PUBLISH,
      actor: { id: 1, role: 'admin' },
      now,
    });

    expect(changes).toEqual(
      expect.objectContaining({
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
        published_by_user_id: 1,
        published_at: now,
        status: true,
      }),
    );
  });

  it('rechaza saltos de estado y acciones desconocidas', () => {
    expect(() =>
      transitionPlagueWorkflow({
        currentStatus: PLAGUE_WORKFLOW_STATUSES.DRAFT,
        action: PLAGUE_WORKFLOW_ACTIONS.PUBLISH,
        actor,
        now,
      }),
    ).toThrow(PlagueWorkflowError);

    expect(() =>
      transitionPlagueWorkflow({
        currentStatus: PLAGUE_WORKFLOW_STATUSES.DRAFT,
        action: 'unknown',
        actor,
        now,
      }),
    ).toThrow(PlagueWorkflowError);
  });

  it('sólo permite editar borradores o registros con cambios solicitados', () => {
    expect(isPlagueEditable(PLAGUE_WORKFLOW_STATUSES.DRAFT)).toBe(true);
    expect(isPlagueEditable(PLAGUE_WORKFLOW_STATUSES.CHANGES_REQUESTED)).toBe(
      true,
    );
    expect(isPlagueEditable(PLAGUE_WORKFLOW_STATUSES.IN_REVIEW)).toBe(false);
    expect(isPlagueEditable(PLAGUE_WORKFLOW_STATUSES.VERIFIED)).toBe(false);
    expect(isPlagueEditable(PLAGUE_WORKFLOW_STATUSES.PUBLISHED)).toBe(false);
  });

  it('limpia las aprobaciones anteriores cuando un registro archivado vuelve a borrador', () => {
    const changes = transitionPlagueWorkflow({
      currentStatus: PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
      action: PLAGUE_WORKFLOW_ACTIONS.RESTORE,
      actor: { id: 1, role: 'admin' },
      now,
    });

    expect(changes).toEqual(
      expect.objectContaining({
        workflow_status: PLAGUE_WORKFLOW_STATUSES.DRAFT,
        verified_by_user_id: null,
        verified_at: null,
        published_by_user_id: null,
        published_at: null,
        status: false,
      }),
    );
  });

  it('incluye una migración reversible y una estrategia explícita para datos existentes', () => {
    const migration = fs.readFileSync(
      new URL(
        '../../src/migrations/20260831000001-add-plague-workflow.js',
        import.meta.url,
      ),
      'utf8',
    );

    expect(migration).toMatch(/addColumn\(\s*'Plagues',\s*'workflow_status'/);
    expect(migration).toMatch(/status[^\n]+verified_by[^\n]+published/i);
    expect(migration).toMatch(/status[^\n]+in_review/i);
    expect(migration).toMatch(
      /removeColumn\(\s*'Plagues',\s*'workflow_status'/,
    );
  });

  it('no permite falsificar publicación o verificación desde el formulario editorial', () => {
    const catalogView = fs.readFileSync(
      new URL('../../src/views/private/catalog/plagues.hbs', import.meta.url),
      'utf8',
    );
    const detailView = fs.readFileSync(
      new URL('../../src/views/shared/plague-detail.hbs', import.meta.url),
      'utf8',
    );

    expect(catalogView).not.toMatch(/name=["']verified_by["']/);
    expect(catalogView).not.toMatch(/name=["']verified_at["']/);
    expect(catalogView).not.toMatch(/name=["']status["']/);
    expect(detailView).toContain('/private/plagues/{{plague.id}}/workflow');
  });
});
