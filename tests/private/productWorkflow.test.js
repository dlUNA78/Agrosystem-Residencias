import { describe, expect, it } from '@jest/globals';

import {
  PRODUCT_WORKFLOW_ACTIONS,
  PRODUCT_WORKFLOW_STATUSES,
  ProductWorkflowError,
  isProductEditable,
  transitionProductWorkflow,
} from '../../src/services/productWorkflowService.js';
import {
  canPerformContextualProductWorkflowAction,
  getContextualProductPermissions,
} from '../../src/services/productAuthorizationService.js';

describe('workflow y RBAC de productos', () => {
  it.each([
    ['draft', 'submit_review', 'in_review'],
    ['in_review', 'verify', 'verified'],
    ['verified', 'publish', 'published'],
    ['published', 'archive', 'archived'],
    ['archived', 'restore', 'draft'],
  ])('permite %s → %s → %s', (currentStatus, action, expected) => {
    expect(
      transitionProductWorkflow({
        currentStatus,
        action,
        actor: { id: 1 },
      }).workflow_status,
    ).toBe(expected);
  });

  it('mantiene status=true únicamente al publicar y status=false al archivar o restaurar', () => {
    const published = transitionProductWorkflow({
      currentStatus: 'verified',
      action: 'publish',
      actor: { id: 1 },
    });
    const archived = transitionProductWorkflow({
      currentStatus: 'published',
      action: 'archive',
      actor: { id: 1 },
    });
    const restored = transitionProductWorkflow({
      currentStatus: 'archived',
      action: 'restore',
      actor: { id: 1 },
    });

    expect(published.status).toBe(true);
    expect(archived.status).toBe(false);
    expect(restored.status).toBe(false);
  });

  it('exige observaciones para solicitar cambios', () => {
    expect(() =>
      transitionProductWorkflow({
        currentStatus: PRODUCT_WORKFLOW_STATUSES.IN_REVIEW,
        action: PRODUCT_WORKFLOW_ACTIONS.REQUEST_CHANGES,
        actor: { id: 2 },
      }),
    ).toThrow(ProductWorkflowError);
  });

  it('sólo deja editar al autor INIFAP y revisar a otro INIFAP', () => {
    const author = getContextualProductPermissions({
      role: 'inifap',
      userId: 12,
      createdByUserId: 12,
    });
    const reviewer = getContextualProductPermissions({
      role: 'inifap',
      userId: 27,
      createdByUserId: 12,
    });

    expect(author.canEdit).toBe(true);
    expect(author.canVerify).toBe(false);
    expect(reviewer.canEdit).toBe(false);
    expect(reviewer.canVerify).toBe(true);
  });

  it('reserva publicación para administrador', () => {
    expect(
      canPerformContextualProductWorkflowAction({
        role: 'admin',
        userId: 1,
        createdByUserId: 12,
        action: 'publish',
      }),
    ).toBe(true);
    expect(
      canPerformContextualProductWorkflowAction({
        role: 'inifap',
        userId: 27,
        createdByUserId: 12,
        action: 'publish',
      }),
    ).toBe(false);
  });

  it('sólo considera editables borrador y cambios solicitados', () => {
    expect(isProductEditable('draft')).toBe(true);
    expect(isProductEditable('changes_requested')).toBe(true);
    expect(isProductEditable('published')).toBe(false);
  });

  describe('baja justificada y principio de 4 ojos en productos', () => {
    it('exige justificación técnica de al menos 20 caracteres al solicitar baja', () => {
      expect(() =>
        transitionProductWorkflow({
          currentStatus: PRODUCT_WORKFLOW_STATUSES.PUBLISHED,
          action: PRODUCT_WORKFLOW_ACTIONS.REQUEST_ARCHIVE,
          actor: { id: 10 },
          archiveReason: 'Muy corta',
        }),
      ).toThrow(ProductWorkflowError);
    });

    it('registra solicitud de baja en archive_pending', () => {
      const changes = transitionProductWorkflow({
        currentStatus: PRODUCT_WORKFLOW_STATUSES.PUBLISHED,
        action: PRODUCT_WORKFLOW_ACTIONS.REQUEST_ARCHIVE,
        actor: { id: 10 },
        archiveReason: 'Retiro de registro sanitario oficial por COFEPRIS.',
        archiveReasonCategory: 'regulatorio',
      });

      expect(changes.workflow_status).toBe(
        PRODUCT_WORKFLOW_STATUSES.ARCHIVE_PENDING,
      );
      expect(changes.archive_requested_by_user_id).toBe(10);
      expect(changes.archive_reason_category).toBe('regulatorio');
    });

    it('bloquea que el mismo usuario solicitante apruebe la baja', () => {
      expect(() =>
        transitionProductWorkflow({
          currentStatus: PRODUCT_WORKFLOW_STATUSES.ARCHIVE_PENDING,
          action: PRODUCT_WORKFLOW_ACTIONS.APPROVE_ARCHIVE,
          actor: { id: 10 },
          record: { archive_requested_by_user_id: 10 },
        }),
      ).toThrow(ProductWorkflowError);
    });

    it('permite que un segundo usuario apruebe la baja', () => {
      const changes = transitionProductWorkflow({
        currentStatus: PRODUCT_WORKFLOW_STATUSES.ARCHIVE_PENDING,
        action: PRODUCT_WORKFLOW_ACTIONS.APPROVE_ARCHIVE,
        actor: { id: 25 },
        record: { archive_requested_by_user_id: 10 },
      });

      expect(changes.workflow_status).toBe(PRODUCT_WORKFLOW_STATUSES.ARCHIVED);
      expect(changes.archived_by_user_id).toBe(25);
      expect(changes.status).toBe(false);
    });
  });
});
