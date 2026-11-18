export const INGREDIENT_WORKFLOW_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVE_PENDING: 'archive_pending',
  ARCHIVED: 'archived',
});

export const INGREDIENT_WORKFLOW_ACTIONS = Object.freeze({
  REQUEST_ARCHIVE: 'request_archive',
  APPROVE_ARCHIVE: 'approve_archive',
  REJECT_ARCHIVE: 'reject_archive',
  RESTORE: 'restore',
});

const transitions = Object.freeze({
  [INGREDIENT_WORKFLOW_STATUSES.ACTIVE]: {
    [INGREDIENT_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]:
      INGREDIENT_WORKFLOW_STATUSES.ARCHIVE_PENDING,
  },
  [INGREDIENT_WORKFLOW_STATUSES.ARCHIVE_PENDING]: {
    [INGREDIENT_WORKFLOW_ACTIONS.APPROVE_ARCHIVE]:
      INGREDIENT_WORKFLOW_STATUSES.ARCHIVED,
    [INGREDIENT_WORKFLOW_ACTIONS.REJECT_ARCHIVE]:
      INGREDIENT_WORKFLOW_STATUSES.ACTIVE,
  },
  [INGREDIENT_WORKFLOW_STATUSES.ARCHIVED]: {
    [INGREDIENT_WORKFLOW_ACTIONS.RESTORE]: INGREDIENT_WORKFLOW_STATUSES.ACTIVE,
  },
});

export class IngredientWorkflowError extends Error {
  constructor(message, code = 'INVALID_TRANSITION') {
    super(message);
    this.name = 'IngredientWorkflowError';
    this.code = code;
  }
}

const handleRequestArchive = ({
  actor,
  now,
  archiveReason,
  archiveReasonCategory,
}) => {
  const reason = String(archiveReason || '').trim();
  if (reason.length < 20) {
    throw new IngredientWorkflowError(
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
    throw new IngredientWorkflowError(
      'Principio de aprobación dual: la baja debe ser dictaminada y aprobada por un especialista distinto al solicitante.',
      'DUAL_APPROVAL_REQUIRED',
    );
  }
  return {
    archived_by_user_id: actor.id,
    archived_at: now,
    archive_approval_notes: normalizedNotes || null,
  };
};

const actionChanges = Object.freeze({
  [INGREDIENT_WORKFLOW_ACTIONS.REQUEST_ARCHIVE]: handleRequestArchive,
  [INGREDIENT_WORKFLOW_ACTIONS.APPROVE_ARCHIVE]: handleApproveArchive,
  [INGREDIENT_WORKFLOW_ACTIONS.REJECT_ARCHIVE]: ({ normalizedNotes }) => ({
    archive_requested_by_user_id: null,
    archive_requested_at: null,
    archive_approval_notes:
      normalizedNotes || 'Solicitud de baja rechazada tras evaluación técnica.',
  }),
  [INGREDIENT_WORKFLOW_ACTIONS.RESTORE]: () => ({
    archive_reason: null,
    archive_reason_category: null,
    archive_requested_by_user_id: null,
    archive_requested_at: null,
    archived_by_user_id: null,
    archived_at: null,
    archive_approval_notes: null,
  }),
});

const resolveNextStatus = (currentStatus, action) => {
  const statusKey = transitions[currentStatus]
    ? currentStatus
    : INGREDIENT_WORKFLOW_STATUSES.ACTIVE;
  const next = transitions[statusKey][action];
  if (!next) {
    throw new IngredientWorkflowError(
      `La transición ${statusKey} → ${action} no está permitida.`,
    );
  }
  return next;
};

const normalizeNotes = (notes) => {
  const trimmed = typeof notes === 'string' ? notes.trim() : '';
  if (trimmed.length > 500) {
    throw new IngredientWorkflowError(
      'Las observaciones no pueden exceder 500 caracteres.',
      'REVIEW_NOTES_TOO_LONG',
    );
  }
  return trimmed || null;
};

export const transitionIngredientWorkflow = (params) => {
  const {
    currentStatus = INGREDIENT_WORKFLOW_STATUSES.ACTIVE,
    action,
    actor,
    reviewNotes,
    archiveReason,
    archiveReasonCategory,
    record,
    now = new Date(),
  } = params;

  if (!actor?.id) {
    throw new IngredientWorkflowError(
      'Se requiere un usuario autenticado para cambiar el estado.',
      'MISSING_ACTOR',
    );
  }

  const nextStatus = resolveNextStatus(currentStatus, action);
  const normalizedNotes = normalizeNotes(reviewNotes);

  return {
    workflow_status: nextStatus,
    updated_by_user_id: actor.id,
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
