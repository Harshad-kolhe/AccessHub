import type { CurrentUser } from './types';

/** Mirrors AccessHub.Domain.Constants.PermissionCodes in the API. */
export const PermissionCodes = {
  OrganizationsManage: 'organizations.manage',
  UsersRead: 'users.read',
  UsersWrite: 'users.write',
  RolesRead: 'roles.read',
  RolesWrite: 'roles.write',
  AuditRead: 'audit.read',
  InvoicesRead: 'invoices.read',
  InvoicesWrite: 'invoices.write',
} as const;

export interface PermissionInfo {
  code: string;
  label: string;
  resource: string;
  /** Platform permissions reach every tenant; only super admins hold them. */
  platform?: boolean;
}

/** Display names for the permission catalog, in the order the UI lists them. */
export const PERMISSION_CATALOG: PermissionInfo[] = [
  { code: PermissionCodes.UsersRead, label: 'View users', resource: 'Users' },
  { code: PermissionCodes.UsersWrite, label: 'Create and edit users', resource: 'Users' },
  { code: PermissionCodes.RolesRead, label: 'View roles', resource: 'Roles' },
  { code: PermissionCodes.RolesWrite, label: 'Create and edit roles', resource: 'Roles' },
  { code: PermissionCodes.InvoicesRead, label: 'View invoices', resource: 'Invoices' },
  { code: PermissionCodes.InvoicesWrite, label: 'Create invoices', resource: 'Invoices' },
  { code: PermissionCodes.AuditRead, label: 'View the audit log', resource: 'Audit log' },
  { code: PermissionCodes.OrganizationsManage, label: 'Manage every organization', resource: 'Organizations', platform: true },
];

const CATALOG_ORDER = new Map(PERMISSION_CATALOG.map((permission, index) => [permission.code, index]));

/** Lists codes in catalog order (users, roles, invoices, audit...) so roles are easy to compare. */
export function sortPermissionCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => (CATALOG_ORDER.get(a) ?? 99) - (CATALOG_ORDER.get(b) ?? 99));
}

/**
 * Decides what the UI shows. It is not a security boundary: the API checks the permission again on every request.
 */
export function hasPermission(user: CurrentUser, code: string): boolean {
  return user.isSuperAdmin || user.permissions.includes(code);
}

/** Permissions the user can't add to or remove from a role: nobody hands out access they don't hold. */
export function blockedPermissions(user: CurrentUser): string[] {
  return user.isSuperAdmin ? [] : PERMISSION_CATALOG.map((permission) => permission.code).filter((code) => !hasPermission(user, code));
}
