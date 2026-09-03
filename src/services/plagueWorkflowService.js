export const PLAGUE_WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

export const PLAGUE_WORKFLOW_ACTIONS = Object.freeze({
  SUBMIT_REVIEW: 'submit_review',
  REQUEST_CHANGES: 'request_changes',
  VERIFY: 'verify',
  PUBLISH: 'publish',
  ARCHIVE: 'archive',
  RESTORE: 'restore',
});

const transitions = Object.freeze({
  [PLAGUE_WORKFLOW_STATUSES.DRAFT]: {
    [PLAGUE_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW,
  },
  [PLAGUE_WORKFLOW_STATUSES.IN_REVIEW]: {
    [PLAGUE_WORKFLOW_ACTIONS.REQUEST_CHANGES]:
      PLAGUE_WORKFLOW_STATUSES.CHANGES_REQUESTED,
    [PLAGUE_WORKFLOW_ACTIONS.VERIFY]: PLAGUE_WORKFLOW_STATUSES.VERIFIED,
  },
  [PLAGUE_WORKFLOW_STATUSES.CHANGES_REQUESTED]: {
    [PLAGUE_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW,
  },
  [PLAGUE_WORKFLOW_STATUSES.VERIFIED]: {
    [PLAGUE_WORKFLOW_ACTIONS.PUBLISH]: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
  },
  [PLAGUE_WORKFLOW_STATUSES.PUBLISHED]: {
    [PLAGUE_WORKFLOW_ACTIONS.ARCHIVE]: PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
  },
  [PLAGUE_WORKFLOW_STATUSES.ARCHIVED]: {
    [PLAGUE_WORKFLOW_ACTIONS.RESTORE]: PLAGUE_WORKFLOW_STATUSES.DRAFT,
  },
});

export class PlagueWorkflowError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'PlagueWorkflowError';
    this.code = code;
  }
}

export const isPlagueEditable = (status) => {
  return [
    PLAGUE_WORKFLOW_STATUSES.DRAFT,
    PLAGUE_WORKFLOW_STATUSES.CHANGES_REQUESTED,
  ].includes(status);
};

export const transitionPlagueWorkflow = ({
  currentStatus,
  action,
  actor,
  now = new Date(),
  reviewNotes,
}) => {
  if (!actor?.id) {
    throw new PlagueWorkflowError(
      'Se requiere un usuario autenticado para cambiar el estado.',
      'MISSING_ACTOR',
    );
  }

  const nextStatus = transitions[currentStatus]?.[action];

  if (!nextStatus) {
    throw new PlagueWorkflowError(
      `La transición ${currentStatus} → ${action} no está permitida.`,
    );
  }

  const normalizedNotes = reviewNotes?.trim() || null;

  if (action === PLAGUE_WORKFLOW_ACTIONS.REQUEST_CHANGES && !normalizedNotes) {
    throw new PlagueWorkflowError(
      'Las solicitudes de cambios requieren observaciones.',
      'REVIEW_NOTES_REQUIRED',
    );
  }

  const changes = {
    workflow_status: nextStatus,
    updated_by_user_id: actor.id,
    status: false,
  };

  if (action === PLAGUE_WORKFLOW_ACTIONS.SUBMIT_REVIEW) {
    changes.review_notes = null;
  }

  if (action === PLAGUE_WORKFLOW_ACTIONS.REQUEST_CHANGES) {
    changes.review_notes = normalizedNotes;
  }

  if (action === PLAGUE_WORKFLOW_ACTIONS.VERIFY) {
    changes.verified_by_user_id = actor.id;
    changes.verified_at = now;
    changes.review_notes = null;
  }

  if (action === PLAGUE_WORKFLOW_ACTIONS.PUBLISH) {
    changes.published_by_user_id = actor.id;
    changes.published_at = now;
    changes.status = true;
  }

  if (action === PLAGUE_WORKFLOW_ACTIONS.RESTORE) {
    changes.verified_by_user_id = null;
    changes.verified_at = null;
    changes.published_by_user_id = null;
    changes.published_at = null;
    changes.review_notes = null;
  }

  return changes;
};
