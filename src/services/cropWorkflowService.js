export const CROP_WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const CROP_WORKFLOW_ACTIONS = Object.freeze({
  SUBMIT_REVIEW: 'submit_review',
  REQUEST_CHANGES: 'request_changes',
  VERIFY: 'verify',
  PUBLISH: 'publish',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
});

const transitions = Object.freeze({
  [CROP_WORKFLOW_STATUSES.DRAFT]: {
    [CROP_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: CROP_WORKFLOW_STATUSES.IN_REVIEW,
  },
  [CROP_WORKFLOW_STATUSES.IN_REVIEW]: {
    [CROP_WORKFLOW_ACTIONS.REQUEST_CHANGES]:
      CROP_WORKFLOW_STATUSES.CHANGES_REQUESTED,
    [CROP_WORKFLOW_ACTIONS.VERIFY]: CROP_WORKFLOW_STATUSES.VERIFIED,
  },
  [CROP_WORKFLOW_STATUSES.CHANGES_REQUESTED]: {
    [CROP_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: CROP_WORKFLOW_STATUSES.IN_REVIEW,
  },
  [CROP_WORKFLOW_STATUSES.VERIFIED]: {
    [CROP_WORKFLOW_ACTIONS.PUBLISH]: CROP_WORKFLOW_STATUSES.PUBLISHED,
  },
  [CROP_WORKFLOW_STATUSES.PUBLISHED]: {
    [CROP_WORKFLOW_ACTIONS.ARCHIVE]: CROP_WORKFLOW_STATUSES.ARCHIVED,
  },
  [CROP_WORKFLOW_STATUSES.ARCHIVED]: {
    [CROP_WORKFLOW_ACTIONS.RESTORE]: CROP_WORKFLOW_STATUSES.DRAFT,
  },
});

export class CropWorkflowError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'CropWorkflowError';
    this.code = code;
  }
}

export const isCropEditable = (status) =>
  [
    CROP_WORKFLOW_STATUSES.DRAFT,
    CROP_WORKFLOW_STATUSES.CHANGES_REQUESTED,
  ].includes(status);

const actionChanges = Object.freeze({
  [CROP_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: () => ({ review_notes: null }),
  [CROP_WORKFLOW_ACTIONS.REQUEST_CHANGES]: ({ normalizedNotes }) => {
    if (!normalizedNotes) {
      throw new CropWorkflowError(
        'Las solicitudes de cambios requieren observaciones.',
        'REVIEW_NOTES_REQUIRED',
      );
    }

    return { review_notes: normalizedNotes };
  },
  [CROP_WORKFLOW_ACTIONS.VERIFY]: ({ actor, now }) => ({
    verified_by_user_id: actor.id,
    verified_at: now,
    review_notes: null,
  }),
  [CROP_WORKFLOW_ACTIONS.PUBLISH]: ({ actor, now }) => ({
    published_by_user_id: actor.id,
    published_at: now,
    status: 'aprobado',
  }),
  [CROP_WORKFLOW_ACTIONS.ARCHIVE]: () => ({}),
  [CROP_WORKFLOW_ACTIONS.RESTORE]: () => ({
    verified_by_user_id: null,
    verified_at: null,
    published_by_user_id: null,
    published_at: null,
    review_notes: null,
  }),
});

export const transitionCropWorkflow = ({
  currentStatus,
  action,
  actor,
  now = new Date(),
  reviewNotes,
}) => {
  if (!actor?.id) {
    throw new CropWorkflowError(
      'Se requiere un usuario autenticado para cambiar el estado.',
      'MISSING_ACTOR',
    );
  }

  const nextStatus = transitions[currentStatus]?.[action];

  if (!nextStatus) {
    throw new CropWorkflowError(
      `La transición ${currentStatus} → ${action} no está permitida.`,
    );
  }

  const normalizedNotes = reviewNotes?.trim() || null;

  if (normalizedNotes && normalizedNotes.length > 500) {
    throw new CropWorkflowError(
      'Las observaciones no pueden exceder 500 caracteres.',
      'REVIEW_NOTES_TOO_LONG',
    );
  }

  return {
    workflow_status: nextStatus,
    updated_by_user_id: actor.id,
    status: 'pendiente',
    ...actionChanges[action]({ actor, now, normalizedNotes }),
  };
};
