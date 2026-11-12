export const CROP_WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  ARCHIVE_PENDING: 'archive_pending',
  ARCHIVED: 'archived',
});

export const CROP_WORKFLOW_ACTIONS = Object.freeze({
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
    [CROP_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]:
      CROP_WORKFLOW_STATUSES.ARCHIVE_PENDING,
    [CROP_WORKFLOW_ACTIONS.ARCHIVE]: CROP_WORKFLOW_STATUSES.ARCHIVED,
  },
  [CROP_WORKFLOW_STATUSES.PUBLISHED]: {
    [CROP_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]:
      CROP_WORKFLOW_STATUSES.ARCHIVE_PENDING,
    [CROP_WORKFLOW_ACTIONS.ARCHIVE]: CROP_WORKFLOW_STATUSES.ARCHIVED,
  },
  [CROP_WORKFLOW_STATUSES.ARCHIVE_PENDING]: {
    [CROP_WORKFLOW_ACTIONS.APPROVE_ARCHIVE]: CROP_WORKFLOW_STATUSES.ARCHIVED,
    [CROP_WORKFLOW_ACTIONS.REJECT_ARCHIVE]: CROP_WORKFLOW_STATUSES.PUBLISHED,
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

const handleRequestArchive = ({
  actor,
  now,
  archiveReason,
  archiveReasonCategory,
}) => {
  const reason = String(archiveReason || '').trim();
  if (reason.length < 20) {
    throw new CropWorkflowError(
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
    throw new CropWorkflowError(
      'Principio de aprobación dual: la baja debe ser dictaminada y aprobada por un especialista distinto al solicitante.',
      'DUAL_APPROVAL_REQUIRED',
    );
  }
  return {
    status: 'pendiente',
    archived_by_user_id: actor.id,
    archived_at: now,
    archive_approval_notes: normalizedNotes || null,
  };
};

const handleRejectArchive = ({ normalizedNotes }) => ({
  archive_requested_by_user_id: null,
  archive_requested_at: null,
  review_notes:
    normalizedNotes || 'Solicitud de baja rechazada tras evaluación técnica.',
});

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
  [CROP_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]: handleRequestArchive,
  [CROP_WORKFLOW_ACTIONS.APPROVE_ARCHIVE]: handleApproveArchive,
  [CROP_WORKFLOW_ACTIONS.REJECT_ARCHIVE]: handleRejectArchive,
  [CROP_WORKFLOW_ACTIONS.ARCHIVE]: ({ actor, now }) => ({
    archived_by_user_id: actor.id,
    archived_at: now,
    status: 'pendiente',
  }),
  [CROP_WORKFLOW_ACTIONS.RESTORE]: () => ({
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

export const transitionCropWorkflow = ({
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
