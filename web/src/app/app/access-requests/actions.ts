'use server';

import { refresh } from 'next/cache';
import { apiSend } from '@/lib/api';
import { expiryOrNull, guidOrNull } from '@/lib/ids';
import type { ActionResult } from '@/lib/types';

const invalid: ActionResult = { ok: false, error: 'That request is not valid.' };

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) refresh();
  return result;
}

const note = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 500) : null;
};

export async function requestAccess(roleId: string, permission: string | null, reason: string): Promise<ActionResult> {
  const role = guidOrNull(roleId);
  if (!role) return { ok: false, error: 'Pick the role you need.' };
  const code = typeof permission === 'string' && /^[a-z]+\.[a-z]+$/.test(permission) ? permission : null;
  return done(await apiSend('/api/access-requests', 'POST', { roleId: role, permission: code, reason: String(reason ?? '').trim() }, 'The request could not be sent.'));
}

export async function approveRequest(requestId: string, expiresAtUtc: string | null, decisionNote: string): Promise<ActionResult> {
  const id = guidOrNull(requestId);
  const expires = expiryOrNull(expiresAtUtc);
  if (!id) return invalid;
  if (expires === undefined) return { ok: false, error: 'Pick when the access should end.' };
  return done(await apiSend(`/api/access-requests/${id}/approve`, 'POST', { expiresAtUtc: expires, note: note(decisionNote) }, 'The request could not be approved.'));
}

export async function rejectRequest(requestId: string, decisionNote: string): Promise<ActionResult> {
  const id = guidOrNull(requestId);
  if (!id) return invalid;
  return done(await apiSend(`/api/access-requests/${id}/reject`, 'POST', { note: note(decisionNote) }, 'The request could not be declined.'));
}

export async function cancelRequest(requestId: string): Promise<ActionResult> {
  const id = guidOrNull(requestId);
  if (!id) return invalid;
  return done(await apiSend(`/api/access-requests/${id}/cancel`, 'POST', undefined, 'The request could not be withdrawn.'));
}
