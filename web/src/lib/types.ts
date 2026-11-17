/** Shapes returned by the AccessHub API (see src/AccessHub.Application/DTOs in the .NET solution). */

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  accent: string | null;
  userCount: number;
  createdAtUtc: string;
}

export interface UserRole {
  roleId: string;
  roleName: string;
  assignedAtUtc: string;
  /** Temporary access: the role is removed automatically once this passes. */
  expiresAtUtc: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  organizationId: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  /** Invited but has not set a password yet. */
  isInvited: boolean;
  twoFactorEnabled: boolean;
  lockedUntilUtc: string | null;
  lastSignInAtUtc: string | null;
  createdAtUtc: string;
  roles: UserRole[];
}

export interface Role {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  permissionCodes: string[];
  userCount: number;
}

export interface Permission {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  amount: number;
  createdAtUtc: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string | null;
  actorUserId: string;
  actorName: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payloadJson: string | null;
  createdAtUtc: string;
}

export interface AuditFacets {
  actors: { id: string; name: string }[];
  entityTypes: string[];
  actions: string[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type AccessRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface AccessRequest {
  id: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  roleId: string;
  roleName: string;
  permission: string | null;
  reason: string;
  status: AccessRequestStatus;
  createdAtUtc: string;
  decidedByName: string | null;
  decidedAtUtc: string | null;
  decisionNote: string | null;
  grantExpiresAtUtc: string | null;
}

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  permissionCodes: string[];
}

export interface AccessCheck {
  userId: string;
  userName: string;
  permission: string;
  allowed: boolean;
  viaSuperAdmin: boolean;
  grantedBy: { roleId: string; roleName: string; expiresAtUtc: string | null }[];
  effectivePermissions: string[];
}

export interface Insights {
  days: number;
  counts: {
    users: number | null;
    activeUsers: number | null;
    usersWithTwoFactor: number | null;
    roles: number | null;
    invoices: number | null;
    pendingAccessRequests: number | null;
    signIns24h: number | null;
    failedSignIns24h: number | null;
  };
  signInsPerDay: { date: string; succeeded: number; failed: number }[] | null;
  changesPerDay: { date: string; granted: number; revoked: number; changed: number; security: number }[] | null;
  usersPerRole: { roleId: string; role: string; organization: string | null; users: number }[] | null;
  expiringSoon: { userId: string; userName: string; roleId: string; roleName: string; expiresAtUtc: string }[] | null;
}

export interface Session {
  id: string;
  startedAtUtc: string;
  lastActiveAtUtc: string;
  expiresAtUtc: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  sessionId: string;
}

/** GET /api/auth/me, and the user returned with every sign-in. */
export interface MeResponse {
  userId: string;
  email: string;
  fullName: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationAccent: string | null;
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
  sessionId: string | null;
  permissions: string[];
}

/** Every sign-in endpoint: either tokens, or (two-factor) a challenge for the code step. */
export interface AuthResponse {
  requiresTwoFactor: boolean;
  challengeToken: string | null;
  tokens: SessionTokens | null;
  user: MeResponse | null;
}

/** The signed-in user as the UI sees it. Deliberately has no token: the JWT never leaves the server. */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationAccent: string | null;
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
  sessionId: string | null;
  permissions: string[];
}

/** What a Server Action reports back to the form that called it. */
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
