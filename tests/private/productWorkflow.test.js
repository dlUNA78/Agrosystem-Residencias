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
});
