import { PRODUCT_WORKFLOW_ACTIONS } from './productWorkflowService.js';

export const PRODUCT_PERMISSIONS = Object.freeze({
  VIEW_PRIVATE: 'products.viewPrivate',
  CREATE: 'products.create',
  EDIT: 'products.edit',
  MANAGE_RELATIONS: 'products.manageRelations',
  SUBMIT_REVIEW: 'products.submitReview',
  VERIFY: 'products.verify',
  PUBLISH: 'products.publish',
  ARCHIVE: 'products.archive',
  RESTORE: 'products.restore',
  DELETE: 'products.delete',
});

const flags = Object.freeze({
  [PRODUCT_PERMISSIONS.VIEW_PRIVATE]: 'canViewPrivate',
  [PRODUCT_PERMISSIONS.CREATE]: 'canCreate',
  [PRODUCT_PERMISSIONS.EDIT]: 'canEdit',
  [PRODUCT_PERMISSIONS.MANAGE_RELATIONS]: 'canManageRelations',
  [PRODUCT_PERMISSIONS.SUBMIT_REVIEW]: 'canSubmitReview',
  [PRODUCT_PERMISSIONS.VERIFY]: 'canVerify',
  [PRODUCT_PERMISSIONS.PUBLISH]: 'canPublish',
  [PRODUCT_PERMISSIONS.ARCHIVE]: 'canArchive',
  [PRODUCT_PERMISSIONS.RESTORE]: 'canRestore',
  [PRODUCT_PERMISSIONS.DELETE]: 'canDelete',
});

const permissions = Object.values(PRODUCT_PERMISSIONS);
const byRole = Object.freeze({
  admin: new Set([
    PRODUCT_PERMISSIONS.VIEW_PRIVATE,
    PRODUCT_PERMISSIONS.CREATE,
    PRODUCT_PERMISSIONS.EDIT,
    PRODUCT_PERMISSIONS.MANAGE_RELATIONS,
    PRODUCT_PERMISSIONS.SUBMIT_REVIEW,
    PRODUCT_PERMISSIONS.PUBLISH,
    PRODUCT_PERMISSIONS.ARCHIVE,
    PRODUCT_PERMISSIONS.RESTORE,
    PRODUCT_PERMISSIONS.DELETE,
  ]),
  inifap: new Set([
    PRODUCT_PERMISSIONS.VIEW_PRIVATE,
    PRODUCT_PERMISSIONS.CREATE,
    PRODUCT_PERMISSIONS.EDIT,
    PRODUCT_PERMISSIONS.MANAGE_RELATIONS,
    PRODUCT_PERMISSIONS.SUBMIT_REVIEW,
    PRODUCT_PERMISSIONS.VERIFY,
  ]),
});
const workflowPermission = Object.freeze({
  [PRODUCT_WORKFLOW_ACTIONS.SUBMIT_REVIEW]: PRODUCT_PERMISSIONS.SUBMIT_REVIEW,
  [PRODUCT_WORKFLOW_ACTIONS.REQUEST_CHANGES]: PRODUCT_PERMISSIONS.VERIFY,
  [PRODUCT_WORKFLOW_ACTIONS.VERIFY]: PRODUCT_PERMISSIONS.VERIFY,
  [PRODUCT_WORKFLOW_ACTIONS.PUBLISH]: PRODUCT_PERMISSIONS.PUBLISH,
  [PRODUCT_WORKFLOW_ACTIONS.ARCHIVE]: PRODUCT_PERMISSIONS.ARCHIVE,
  [PRODUCT_WORKFLOW_ACTIONS.RESTORE]: PRODUCT_PERMISSIONS.RESTORE,
});

export const hasProductPermission = (role, permission) =>
  permissions.includes(permission) && byRole[role]?.has(permission) === true;

export const getProductPermissions = (role) =>
  Object.fromEntries(
    permissions.map((permission) => [
      flags[permission],
      hasProductPermission(role, permission),
    ]),
  );

export const getContextualProductPermissions = ({
  role,
  userId,
  createdByUserId,
}) => {
  const result = getProductPermissions(role);
  if (role !== 'inifap') return result;

  const hasAuthor = createdByUserId !== null && createdByUserId !== undefined;
  const isAuthor = hasAuthor && Number(userId) === Number(createdByUserId);
  return {
    ...result,
    canEdit: result.canEdit && isAuthor,
    canManageRelations: result.canManageRelations && isAuthor,
    canSubmitReview: result.canSubmitReview && isAuthor,
    canVerify: result.canVerify && hasAuthor && !isAuthor,
  };
};

export const getRequiredProductPermissionForWorkflowAction = (action) =>
  workflowPermission[action] || null;

export const canPerformContextualProductWorkflowAction = (input) => {
  const permission = getRequiredProductPermissionForWorkflowAction(
    input.action,
  );
  if (!permission) return false;
  const result = getContextualProductPermissions(input);
  return result[flags[permission]] === true;
};
