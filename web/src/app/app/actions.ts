'use server';

import { redirect } from 'next/navigation';
import { endSession, refreshCurrentSession } from '@/lib/session';

/** Signs out on this device: the API revokes the session's refresh tokens, then the cookies go. */
export async function logout(): Promise<void> {
  await endSession();
  redirect('/login');
}

/**
 * Called by the realtime connection when the user's permissions change: renews the session now, so the
 * next render already uses a token with the new permissions.
 */
export async function syncSession(): Promise<boolean> {
  return (await refreshCurrentSession()) !== null;
}
