export const PLAGUE_WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  ARCHIVE_PENDING: 'archive_pending',
  ARCHIVED: 'archived',
});

export const PLAGUE_WORKFLOW_ACTIONS = Object.freeze({
  SUBMIT_REVIEW: 'submit_review',
  REQUEST_CHANGES: 'request_changes',
  VERIFY: 'verify',
  PUBLISH: 'publish',
  REQUEST_ARCHIVE: 'request_archive',
  APPROVE_ARCHIVE: 'approve_archive',
  REJECT_ARCHIVE: 'reject_archive',
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
    [PLAGUE_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]:
      PLAGUE_WORKFLOW_STATUSES.ARCHIVE_PENDING,
    [PLAGUE_WORKFLOW_ACTIONS.ARCHIVE]: PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
  },
  [PLAGUE_WORKFLOW_STATUSES.PUBLISHED]: {
    [PLAGUE_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]:
      PLAGUE_WORKFLOW_STATUSES.ARCHIVE_PENDING,
    [PLAGUE_WORKFLOW_ACTIONS.ARCHIVE]: PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
  },
  [PLAGUE_WORKFLOW_STATUSES.ARCHIVE_PENDING]: {
    [PLAGUE_WORKFLOW_ACTIONS.APPROVE_ARCHIVE]:
      PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
    [PLAGUE_WORKFLOW_ACTIONS.REJECT_ARCHIVE]:
      PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
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

export const isPlagueEditable = (status) =>
  [
    PLAGUE_WORKFLOW_STATUSES.DRAFT,
    PLAGUE_WORKFLOW_STATUSES.CHANGES_REQUESTED,
  ].includes(status);

const handleRequestArchive = ({
  actor,
  now,
  archiveReason,
  archiveReasonCategory,
}) => {
  const reason = String(archiveReason || '').trim();
  if (reason.length < 20) {
    throw new PlagueWorkflowError(
      'La justificación técnica de baja debe tener al menos 20 caracteres.',
      'ARCHIVE_REASON_REQUIRED',
    );
  }
  return {
    archive_reason: reason,
    archive_reason_category: archiveReasonCategory || 'otro',
    archive_requested_by_user_id: actor.id,
    archive_requested_at: now,
  };
};

const handleApproveArchive = ({ actor, now, record, normalizedNotes }) => {
  const requesterId = record?.archive_requested_by_user_id;
  if (requesterId && Number(requesterId) === Number(actor.id)) {
    throw new PlagueWorkflowError(
      'Principio de aprobación dual: la baja debe ser dictaminada y aprobada por un especialista distinto al solicitante.',
      'DUAL_APPROVAL_REQUIRED',
    );
  }
  return {
    status: false,
    archived_by_user_id: actor.id,
    archived_at: now,
    archive_approval_notes: normalizedNotes || null,
  };
};

const actionChanges = Object.freeze({
  [PLAGUE_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: () => ({ review_notes: null }),
  [PLAGUE_WORKFLOW_ACTIONS.REQUEST_CHANGES]: ({ normalizedNotes }) => {
    if (!normalizedNotes) {
      throw new PlagueWorkflowError(
        'Las solicitudes de cambios requieren observaciones.',
        'REVIEW_NOTES_REQUIRED',
      );
    }
    return { review_notes: normalizedNotes };
  },
  [PLAGUE_WORKFLOW_ACTIONS.VERIFY]: ({ actor, now }) => ({
    verified_by_user_id: actor.id,
    verified_at: now,
    review_notes: null,
  }),
  [PLAGUE_WORKFLOW_ACTIONS.PUBLISH]: ({ actor, now }) => ({
    published_by_user_id: actor.id,
    published_at: now,
    status: true,
  }),
  [PLAGUE_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]: handleRequestArchive,
  [PLAGUE_WORKFLOW_ACTIONS.APPROVE_ARCHIVE]: handleApproveArchive,
  [PLAGUE_WORKFLOW_ACTIONS.REJECT_ARCHIVE]: ({ normalizedNotes }) => ({
    archive_requested_by_user_id: null,
    archive_requested_at: null,
    review_notes:
      normalizedNotes || 'Solicitud de baja rechazada tras evaluación técnica.',
  }),
  [PLAGUE_WORKFLOW_ACTIONS.ARCHIVE]: ({ actor, now }) => ({
    archived_by_user_id: actor.id,
    archived_at: now,
    status: false,
  }),
  [PLAGUE_WORKFLOW_ACTIONS.RESTORE]: () => ({
    verified_by_user_id: null,
    verified_at: null,
    published_by_user_id: null,
    published_at: null,
    review_notes: null,
    archive_reason: null,
    archive_reason_category: null,
    archive_requested_by_user_id: null,
    archive_requested_at: null,
    archived_by_user_id: null,
    archived_at: null,
    archive_approval_notes: null,
  }),
});

export const transitionPlagueWorkflow = ({
  currentStatus,
  action,
  actor,
  now = new Date(),
  reviewNotes,
  archiveReason,
  archiveReasonCategory,
  record,
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

  return {
    workflow_status: nextStatus,
    updated_by_user_id: actor.id,
    status: false,
    ...actionChanges[action]({
      actor,
      now,
      normalizedNotes,
      archiveReason,
      archiveReasonCategory,
      record,
    }),
  };
};
