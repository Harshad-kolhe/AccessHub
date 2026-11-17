'use server';

import { refresh } from 'next/cache';
import { apiSend } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { expiryOrNull, guidOrNull } from '@/lib/ids';
import type { ActionResult } from '@/lib/types';

const invalid = (what: string): ActionResult => ({ ok: false, error: `That ${what} is not valid.` });

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) refresh();
  return result;
}

export interface InviteInput {
  email: string;
  fullName: string;
  roleIds: string[];
}

/** Invited people join the caller's organization (taken from the session, never from the browser). */
export async function inviteUser(input: InviteInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.organizationId) return { ok: false, error: 'Invitations belong to an organization.' };

  const roleIds = (Array.isArray(input?.roleIds) ? input.roleIds : []).map(guidOrNull).filter((id): id is string => id !== null);
  return done(
    await apiSend(
      '/api/users/invite',
      'POST',
      { email: String(input?.email ?? '').trim(), fullName: String(input?.fullName ?? '').trim(), organizationId: user.organizationId, roleIds },
      'The invitation could not be sent.',
    ),
  );
}

export async function resendInvite(userId: string): Promise<ActionResult> {
  const id = guidOrNull(userId);
  if (!id) return invalid('person');
  return done(await apiSend(`/api/users/${id}/resend-invite`, 'POST', undefined, 'The invitation could not be sent again.'));
}

/** Renames, deactivates or reactivates. Deactivating signs the person out everywhere at once. */
export async function updateUser(userId: string, fullName: string, isActive: boolean): Promise<ActionResult> {
  const id = guidOrNull(userId);
  if (!id) return invalid('person');
  return done(
    await apiSend(`/api/users/${id}`, 'PUT', { fullName: String(fullName ?? '').trim(), isActive: Boolean(isActive) }, 'The change could not be saved.'),
  );
}

/** Grants a role, permanently (null) or until a moment in the future. */
export async function grantRole(userId: string, roleId: string, expiresAtUtc: string | null): Promise<ActionResult> {
  const id = guidOrNull(userId);
  const role = guidOrNull(roleId);
  const expires = expiryOrNull(expiresAtUtc);
  if (!id || !role) return invalid('role');
  if (expires === undefined) return { ok: false, error: 'Pick when the access should end.' };
  return done(await apiSend(`/api/users/${id}/roles`, 'POST', { roleId: role, expiresAtUtc: expires }, 'The role could not be granted.'));
}

export async function revokeRole(userId: string, roleId: string): Promise<ActionResult> {
  const id = guidOrNull(userId);
  const role = guidOrNull(roleId);
  if (!id || !role) return invalid('role');
  return done(await apiSend(`/api/users/${id}/roles/${role}`, 'DELETE', undefined, 'The role could not be removed.'));
}
