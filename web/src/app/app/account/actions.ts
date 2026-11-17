'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { apiSend } from '@/lib/api';
import { guidOrNull } from '@/lib/ids';
import { endSession, refreshCurrentSession } from '@/lib/session';
import type { ActionResult } from '@/lib/types';

const code = (value: unknown) => String(value ?? '').replace(/[\s-]/g, '').slice(0, 12);

/**
 * Two-factor changes rotate the security stamp, which revokes the current access token. Renewing the session
 * right away keeps the next render from bouncing through /auth/refresh.
 */
async function renewed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) {
    await refreshCurrentSession();
    refresh();
  }
  return result;
}

export interface TwoFactorSetup {
  sharedKey: string;
  /** The otpauth:// link as an SVG QR code, drawn on the server. */
  qrSvg: string;
}

export async function startTwoFactorSetup(): Promise<ActionResult<TwoFactorSetup>> {
  const result = await apiSend<{ sharedKey: string; authenticatorUri: string }>('/api/account/two-factor/setup', 'POST', undefined, 'Two-factor setup could not start.');
  if (!result.ok || !result.data) return result.ok ? { ok: false, error: 'Two-factor setup could not start.' } : result;

  const qrSvg = await QRCode.toString(result.data.authenticatorUri, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  return { ok: true, data: { sharedKey: result.data.sharedKey, qrSvg } };
}

export async function enableTwoFactor(value: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  return renewed(await apiSend<{ recoveryCodes: string[] }>('/api/account/two-factor/enable', 'POST', { code: code(value) }, 'That code didn’t work.'));
}

export async function disableTwoFactor(value: string): Promise<ActionResult> {
  return renewed(await apiSend('/api/account/two-factor/disable', 'POST', { code: code(value) }, 'That code didn’t work.'));
}

export async function newRecoveryCodes(value: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  return apiSend<{ recoveryCodes: string[] }>('/api/account/two-factor/recovery-codes', 'POST', { code: code(value) }, 'That code didn’t work.');
}

/** Signs out one other device. The current access token is revoked too (stamp change), so renew it. */
export async function revokeSession(sessionId: string): Promise<ActionResult> {
  const id = guidOrNull(sessionId);
  if (!id) return { ok: false, error: 'That session is not valid.' };
  return renewed(await apiSend(`/api/account/sessions/${id}`, 'DELETE', undefined, 'That device could not be signed out.'));
}

/** Every device, this one included: back to the sign-in page. */
export async function signOutEverywhere(): Promise<ActionResult> {
  const result = await apiSend('/api/account/sessions/revoke-all', 'POST', undefined, 'Could not sign out everywhere.');
  if (!result.ok) return result;
  await endSession();
  redirect('/login?reason=signed-out-everywhere');
}
