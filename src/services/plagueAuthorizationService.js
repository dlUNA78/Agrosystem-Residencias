import { PLAGUE_WORKFLOW_ACTIONS } from './plagueWorkflowService.js';

export const PLAGUE_PERMISSIONS = Object.freeze({
  VIEW_PRIVATE: 'plagues.viewPrivate',
  CREATE: 'plagues.create',
  EDIT: 'plagues.edit',
  MANAGE_RELATIONS: 'plagues.manageRelations',
  SUBMIT_REVIEW: 'plagues.submitReview',
  VERIFY: 'plagues.verify',
  PUBLISH: 'plagues.publish',
  ARCHIVE: 'plagues.archive',
  RESTORE: 'plagues.restore',
  DELETE: 'plagues.delete',
});

const permissionFlags = Object.freeze({
  [PLAGUE_PERMISSIONS.VIEW_PRIVATE]: 'canViewPrivate',
  [PLAGUE_PERMISSIONS.CREATE]: 'canCreate',
  [PLAGUE_PERMISSIONS.EDIT]: 'canEdit',
  [PLAGUE_PERMISSIONS.MANAGE_RELATIONS]: 'canManageRelations',
  [PLAGUE_PERMISSIONS.SUBMIT_REVIEW]: 'canSubmitReview',
  [PLAGUE_PERMISSIONS.VERIFY]: 'canVerify',
  [PLAGUE_PERMISSIONS.PUBLISH]: 'canPublish',
  [PLAGUE_PERMISSIONS.ARCHIVE]: 'canArchive',
  [PLAGUE_PERMISSIONS.RESTORE]: 'canRestore',
  [PLAGUE_PERMISSIONS.DELETE]: 'canDelete',
});

const allPermissions = Object.freeze(Object.values(PLAGUE_PERMISSIONS));

const permissionsByRole = Object.freeze({
  admin: new Set(allPermissions),
  inifap: new Set([
    PLAGUE_PERMISSIONS.VIEW_PRIVATE,
    PLAGUE_PERMISSIONS.CREATE,
    PLAGUE_PERMISSIONS.EDIT,
    PLAGUE_PERMISSIONS.MANAGE_RELATIONS,
    PLAGUE_PERMISSIONS.SUBMIT_REVIEW,
    PLAGUE_PERMISSIONS.VERIFY,
  ]),
});

const workflowPermissions = Object.freeze({
  [PLAGUE_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: PLAGUE_PERMISSIONS.SUBMIT_REVIEW,
  [PLAGUE_WORKFLOW_ACTIONS.REQUEST_CHANGES]: PLAGUE_PERMISSIONS.VERIFY,
  [PLAGUE_WORKFLOW_ACTIONS.VERIFY]: PLAGUE_PERMISSIONS.VERIFY,
  [PLAGUE_WORKFLOW_ACTIONS.PUBLISH]: PLAGUE_PERMISSIONS.PUBLISH,
  [PLAGUE_WORKFLOW_ACTIONS.ARCHIVE]: PLAGUE_PERMISSIONS.ARCHIVE,
  [PLAGUE_WORKFLOW_ACTIONS.RESTORE]: PLAGUE_PERMISSIONS.RESTORE,
});

export const hasPlaguePermission = (role, permission) => {
  if (!allPermissions.includes(permission)) {
    return false;
  }

  return permissionsByRole[role]?.has(permission) === true;
};

export const getPlaguePermissions = (role) => {
  return Object.fromEntries(
    allPermissions.map((permission) => [
      permissionFlags[permission],
      hasPlaguePermission(role, permission),
    ]),
  );
};

export const getRequiredPlaguePermissionForWorkflowAction = (action) => {
  return workflowPermissions[action] || null;
};
