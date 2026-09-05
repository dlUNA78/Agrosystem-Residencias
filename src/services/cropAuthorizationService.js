import { CROP_WORKFLOW_ACTIONS } from './cropWorkflowService.js';

export const CROP_PERMISSIONS = Object.freeze({
  VIEW_PRIVATE: 'crops.viewPrivate',
  CREATE: 'crops.create',
  EDIT: 'crops.edit',
  MANAGE_RELATIONS: 'crops.manageRelations',
  SUBMIT_REVIEW: 'crops.submitReview',
  VERIFY: 'crops.verify',
  PUBLISH: 'crops.publish',
  ARCHIVE: 'crops.archive',
  RESTORE: 'crops.restore',
  DELETE: 'crops.delete',
});

const permissionFlags = Object.freeze({
  [CROP_PERMISSIONS.VIEW_PRIVATE]: 'canViewPrivate',
  [CROP_PERMISSIONS.CREATE]: 'canCreate',
  [CROP_PERMISSIONS.EDIT]: 'canEdit',
  [CROP_PERMISSIONS.MANAGE_RELATIONS]: 'canManageRelations',
  [CROP_PERMISSIONS.SUBMIT_REVIEW]: 'canSubmitReview',
  [CROP_PERMISSIONS.VERIFY]: 'canVerify',
  [CROP_PERMISSIONS.PUBLISH]: 'canPublish',
  [CROP_PERMISSIONS.ARCHIVE]: 'canArchive',
  [CROP_PERMISSIONS.RESTORE]: 'canRestore',
  [CROP_PERMISSIONS.DELETE]: 'canDelete',
});

const allPermissions = Object.freeze(Object.values(CROP_PERMISSIONS));

const permissionsByRole = Object.freeze({
  admin: new Set([
    CROP_PERMISSIONS.VIEW_PRIVATE,
    CROP_PERMISSIONS.CREATE,
    CROP_PERMISSIONS.EDIT,
    CROP_PERMISSIONS.MANAGE_RELATIONS,
    CROP_PERMISSIONS.SUBMIT_REVIEW,
    CROP_PERMISSIONS.PUBLISH,
    CROP_PERMISSIONS.ARCHIVE,
    CROP_PERMISSIONS.RESTORE,
    CROP_PERMISSIONS.DELETE,
  ]),
  inifap: new Set([
    CROP_PERMISSIONS.VIEW_PRIVATE,
    CROP_PERMISSIONS.CREATE,
    CROP_PERMISSIONS.EDIT,
    CROP_PERMISSIONS.MANAGE_RELATIONS,
    CROP_PERMISSIONS.SUBMIT_REVIEW,
    CROP_PERMISSIONS.VERIFY,
  ]),
});

const workflowPermissions = Object.freeze({
  [CROP_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: CROP_PERMISSIONS.SUBMIT_REVIEW,
  [CROP_WORKFLOW_ACTIONS.REQUEST_CHANGES]: CROP_PERMISSIONS.VERIFY,
  [CROP_WORKFLOW_ACTIONS.VERIFY]: CROP_PERMISSIONS.VERIFY,
  [CROP_WORKFLOW_ACTIONS.PUBLISH]: CROP_PERMISSIONS.PUBLISH,
  [CROP_WORKFLOW_ACTIONS.ARCHIVE]: CROP_PERMISSIONS.ARCHIVE,
  [CROP_WORKFLOW_ACTIONS.RESTORE]: CROP_PERMISSIONS.RESTORE,
});

export const hasCropPermission = (role, permission) =>
  allPermissions.includes(permission) &&
  permissionsByRole[role]?.has(permission) === true;

export const getCropPermissions = (role) =>
  Object.fromEntries(
    allPermissions.map((permission) => [
      permissionFlags[permission],
      hasCropPermission(role, permission),
    ]),
  );

const sameUser = (userId, createdByUserId) =>
  userId !== null &&
  userId !== undefined &&
  createdByUserId !== null &&
  createdByUserId !== undefined &&
  Number(userId) === Number(createdByUserId);

export const getContextualCropPermissions = ({
  role,
  userId,
  createdByUserId,
}) => {
  const permissions = getCropPermissions(role);

  if (role !== 'inifap') {
    return permissions;
  }

  const isAuthor = sameUser(userId, createdByUserId);
  const hasKnownAuthor =
    createdByUserId !== null && createdByUserId !== undefined;

  return {
    ...permissions,
    canEdit: permissions.canEdit && isAuthor,
    canManageRelations: permissions.canManageRelations && isAuthor,
    canSubmitReview: permissions.canSubmitReview && isAuthor,
    canVerify: permissions.canVerify && hasKnownAuthor && !isAuthor,
  };
};

export const getRequiredCropPermissionForWorkflowAction = (action) =>
  workflowPermissions[action] || null;

export const canPerformContextualCropWorkflowAction = ({
  role,
  userId,
  createdByUserId,
  action,
}) => {
  const permission = getRequiredCropPermissionForWorkflowAction(action);

  if (!permission) return false;

  const permissions = getContextualCropPermissions({
    role,
    userId,
    createdByUserId,
  });

  return permissions[permissionFlags[permission]] === true;
};
