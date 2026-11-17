import 'server-only';
import { cookies, headers } from 'next/headers';
import { API_URL } from './config';
import { CHALLENGE_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from './jwt';
import { clearSessionCookies, cookieOptions, forwardedFor, requestRefresh, writeSessionCookies } from './session-cookies';
import type { SessionTokens } from './types';

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Server Actions and Route Handlers only: Server Components cannot set cookies. */
export async function setSession(tokens: SessionTokens): Promise<void> {
  writeSessionCookies(await cookies(), tokens);
}

export async function setTwoFactorChallenge(challengeToken: string): Promise<void> {
  (await cookies()).set(CHALLENGE_COOKIE, challengeToken, cookieOptions({ maxAge: 5 * 60, sameSite: 'strict' }));
}

export async function getTwoFactorChallenge(): Promise<string | undefined> {
  return (await cookies()).get(CHALLENGE_COOKIE)?.value;
}

export async function clearTwoFactorChallenge(): Promise<void> {
  (await cookies()).delete(CHALLENGE_COOKIE);
}

/** The browser's address and user agent for the API (see forwardedFor). */
export async function clientHeaders(): Promise<Record<string, string>> {
  return forwardedFor(await headers());
}

/**
 * Server Actions and Route Handlers: renews the session now and stores the new tokens. Returns the new access
 * token, or null if the session has ended (the cookies are then cleared).
 */
export async function refreshCurrentSession(): Promise<string | null> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const outcome = await requestRefresh(refreshToken, await clientHeaders());
  if (outcome.status === 'ok') {
    writeSessionCookies(jar, outcome.auth.tokens);
    return outcome.auth.tokens.accessToken;
  }
  if (outcome.status === 'rejected') clearSessionCookies(jar);
  return null;
}

/** Ends the session on the API (revokes this device's refresh-token family) and forgets the cookies. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => null); // the cookies go either way
  }
  clearSessionCookies(jar);
}
