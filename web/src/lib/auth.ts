import 'server-only';
import { cache } from 'react';
import { apiGet } from './api';
import type { CurrentUser, MeResponse } from './types';

/**
 * The signed-in user, loaded from GET /api/auth/me at most once per request (React `cache`), however many
 * components ask. Returns only what the UI needs; the tokens stay on the server.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const result = await apiGet<MeResponse>('/api/auth/me');
  if (!result.ok) throw new Error(result.error);

  const me = result.data;
  return {
    id: me.userId,
    email: me.email,
    fullName: me.fullName,
    organizationId: me.organizationId,
    organizationName: me.organizationName,
    organizationAccent: me.organizationAccent,
    isSuperAdmin: me.isSuperAdmin,
    twoFactorEnabled: me.twoFactorEnabled,
    sessionId: me.sessionId,
    permissions: me.permissions,
  };
});
