'use server';

import { refresh } from 'next/cache';
import { apiSend } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { guidOrNull } from '@/lib/ids';
import type { ActionResult, Role } from '@/lib/types';

export interface RoleInput {
  name: string;
  description: string;
  permissionCodes: string[];
}

function body(input: RoleInput) {
  const description = String(input?.description ?? '').trim();
  return {
    name: String(input?.name ?? '').trim(),
    description: description || null,
    permissionCodes: Array.isArray(input?.permissionCodes) ? [...new Set(input.permissionCodes.map(String))] : [],
  };
}

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) refresh();
  return result;
}

/** Roles belong to the caller's organization. The API rejects platform permissions and anything the caller lacks. */
export async function createRole(input: RoleInput): Promise<ActionResult<Role>> {
  const user = await getCurrentUser();
  if (!user.organizationId) return { ok: false, error: 'Roles belong to an organization.' };
  return done(await apiSend<Role>(`/api/roles?organizationId=${user.organizationId}`, 'POST', body(input), 'The role could not be created.'));
}

export async function updateRole(roleId: string, input: RoleInput): Promise<ActionResult<Role>> {
  const id = guidOrNull(roleId);
  if (!id) return { ok: false, error: 'That role is not valid.' };
  return done(await apiSend<Role>(`/api/roles/${id}`, 'PUT', body(input), 'The role could not be saved.'));
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const id = guidOrNull(roleId);
  if (!id) return { ok: false, error: 'That role is not valid.' };
  return done(await apiSend(`/api/roles/${id}`, 'DELETE', undefined, 'The role could not be deleted.'));
}
