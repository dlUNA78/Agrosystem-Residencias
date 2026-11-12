export const PRODUCT_WORKFLOW_STATUSES = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  VERIFIED: 'verified',
  PUBLISHED: 'published',
  ARCHIVE_PENDING: 'archive_pending',
  ARCHIVED: 'archived',
});

export const PRODUCT_WORKFLOW_ACTIONS = Object.freeze({
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
  draft: { submit_review: 'in_review' },
  in_review: { request_changes: 'changes_requested', verify: 'verified' },
  changes_requested: { submit_review: 'in_review' },
  verified: {
    publish: 'published',
    request_archive: 'archive_pending',
    archive: 'archived',
  },
  published: {
    request_archive: 'archive_pending',
    archive: 'archived',
  },
  archive_pending: {
    approve_archive: 'archived',
    reject_archive: 'published',
  },
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

const handleRequestArchive = ({
  actor,
  now,
  archiveReason,
  archiveReasonCategory,
}) => {
  const reason = String(archiveReason || '').trim();
  if (reason.length < 20) {
    throw new ProductWorkflowError(
      'La justificación técnica de baja debe tener al menos 20 caracteres.',
      'ARCHIVE_REASON_REQUIRED',
    );
  }
  return {
    validation_status: 'Baja en trámite',
    archive_reason: reason,
    archive_reason_category: archiveReasonCategory || 'otro',
    archive_requested_by_user_id: actor.id,
    archive_requested_at: now,
  };
};

const handleApproveArchive = ({ actor, now, record, normalizedNotes }) => {
  const requesterId = record?.archive_requested_by_user_id;
  if (requesterId && Number(requesterId) === Number(actor.id)) {
    throw new ProductWorkflowError(
      'Principio de aprobación dual: la baja debe ser dictaminada y aprobada por un especialista distinto al solicitante.',
      'DUAL_APPROVAL_REQUIRED',
    );
  }
  return {
    validation_status: 'Retirado',
    status: false,
    archived_by_user_id: actor.id,
    archived_at: now,
    archive_approval_notes: normalizedNotes || null,
  };
};

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
  request_archive: handleRequestArchive,
  approve_archive: handleApproveArchive,
  reject_archive: ({ normalizedNotes }) => ({
    validation_status: 'Aprobado',
    archive_requested_by_user_id: null,
    archive_requested_at: null,
    review_notes:
      normalizedNotes || 'Solicitud de baja rechazada tras evaluación técnica.',
  }),
  archive: ({ actor, now }) => ({
    validation_status: 'Retirado',
    status: false,
    archived_by_user_id: actor?.id || null,
    archived_at: now,
  }),
  restore: () => ({
    validation_status: 'En revisión',
    status: false,
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

export const transitionProductWorkflow = ({
  currentStatus,
  action,
  actor,
  reviewNotes,
  archiveReason,
  archiveReasonCategory,
  record,
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
