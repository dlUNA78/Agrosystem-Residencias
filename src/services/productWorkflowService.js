export const PRODUCT_WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const PRODUCT_WORKFLOW_ACTIONS = Object.freeze({
  SUBMIT_REVIEW: 'submit_review',
  REQUEST_CHANGES: 'request_changes',
  VERIFY: 'verify',
  PUBLISH: 'publish',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
});

const transitions = Object.freeze({
  draft: { submit_review: 'in_review' },
  in_review: { request_changes: 'changes_requested', verify: 'verified' },
  changes_requested: { submit_review: 'in_review' },
  verified: { publish: 'published' },
  published: { archive: 'archived' },
  archived: { restore: 'draft' },
});

export class ProductWorkflowError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'ProductWorkflowError';
    this.code = code;
  }
}

export const isProductEditable = (status) =>
  ['draft', 'changes_requested'].includes(status);

const actionChanges = Object.freeze({
  submit_review: () => ({
    validation_status: 'En revisión',
    review_notes: null,
  }),
  request_changes: ({ normalizedNotes }) => {
    if (!normalizedNotes) {
      throw new ProductWorkflowError(
        'Las solicitudes de cambios requieren observaciones.',
        'REVIEW_NOTES_REQUIRED',
      );
    }
    return {
      validation_status: 'Cambios solicitados',
      review_notes: normalizedNotes,
    };
  },
  verify: ({ actor, now }) => ({
    validation_status: 'Validado',
    verified_by_user_id: actor.id,
    verified_at: now,
    review_notes: null,
  }),
  publish: ({ actor, now }) => ({
    validation_status: 'Aprobado',
    status: true,
    published_by_user_id: actor.id,
    published_at: now,
  }),
  archive: () => ({ status: false }),
  restore: () => ({
    validation_status: 'En revisión',
    status: true,
    verified_by_user_id: null,
    verified_at: null,
    published_by_user_id: null,
    published_at: null,
    review_notes: null,
  }),
});

export const transitionProductWorkflow = ({
  currentStatus,
  action,
  actor,
  reviewNotes,
  now = new Date(),
}) => {
  if (!actor?.id) {
    throw new ProductWorkflowError(
      'Se requiere un usuario autenticado para cambiar el estado.',
      'MISSING_ACTOR',
    );
  }

  const nextStatus = transitions[currentStatus]?.[action];
  if (!nextStatus) {
    throw new ProductWorkflowError(
      `La transición ${currentStatus} → ${action} no está permitida.`,
    );
  }

  const normalizedNotes = reviewNotes?.trim() || null;
  if (normalizedNotes && normalizedNotes.length > 500) {
    throw new ProductWorkflowError(
      'Las observaciones no pueden exceder 500 caracteres.',
      'REVIEW_NOTES_TOO_LONG',
    );
  }
  return {
    workflow_status: nextStatus,
    updated_by_user_id: actor.id,
    ...actionChanges[action]({ actor, now, normalizedNotes }),
  };
};
