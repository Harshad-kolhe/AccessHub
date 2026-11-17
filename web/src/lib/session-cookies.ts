/**
 * Session cookie helpers that work everywhere on the server, including the proxy (which can't import
 * `server-only` modules or `next/headers`). lib/session.ts builds the request-scoped helpers on top of these.
 *
 * The API's tokens live in httpOnly cookies: the browser sends them to this Next.js server, but page scripts
 * can never read them, so an XSS bug cannot steal them. SameSite=Lax plus the Origin check Next.js runs on
 * every Server Action keep cross-site requests from using them.
 */
import { API_URL } from './config';
import { parseUtc } from './format';
import { CHALLENGE_COOKIE, REFRESHED_COOKIE, REFRESH_COOKIE, SESSION_COOKIE } from './jwt';
import type { AuthResponse, SessionTokens } from './types';

/** Anything with Next's cookie `set` / `delete` methods: `cookies()` in actions and routes, or a proxy response. */
export interface CookieWriter {
  set(name: string, value: string, options: CookieOptions): unknown;
  delete(name: string): unknown;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  expires?: Date;
  maxAge?: number;
}

// Secure cookies need HTTPS (browsers treat localhost as secure). COOKIE_SECURE=false allows a plain-HTTP host.
const secure = (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true';

export function cookieOptions(extra: Partial<CookieOptions> = {}): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', ...extra };
}

export function writeSessionCookies(jar: CookieWriter, tokens: SessionTokens): void {
  jar.set(SESSION_COOKIE, tokens.accessToken, cookieOptions({ expires: parseUtc(tokens.accessTokenExpiresAtUtc) }));
  jar.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions({ expires: parseUtc(tokens.refreshTokenExpiresAtUtc) }));
  jar.set(REFRESHED_COOKIE, '1', cookieOptions({ maxAge: 10 }));
}

export function clearSessionCookies(jar: CookieWriter): void {
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
  jar.delete(CHALLENGE_COOKIE);
}

/**
 * The browser's address and user agent, passed on so the API can rate-limit per client and show
 * "Chrome on Windows, 203.0.113.10" in the session list instead of this server's details.
 * The last X-Forwarded-For entry is the one added by the hop closest to this server, so entries a client
 * prepends to spoof its address are ignored.
 */
export function forwardedFor(incoming: Headers): Record<string, string> {
  const forwarded: Record<string, string> = {};
  const ip = incoming.get('x-forwarded-for')?.split(',').pop()?.trim() || incoming.get('x-real-ip');
  if (ip) forwarded['X-Forwarded-For'] = ip;
  const userAgent = incoming.get('user-agent');
  if (userAgent) forwarded['X-Forwarded-User-Agent'] = userAgent;
  return forwarded;
}

export type SignedInResponse = AuthResponse & { tokens: SessionTokens };

export type RefreshOutcome = { status: 'ok'; auth: SignedInResponse } | { status: 'rejected' } | { status: 'unreachable' };

/** Rotates the refresh token: one call to the API, no cookies touched (callers decide where to write them). */
export async function requestRefresh(refreshToken: string, forwarded: Record<string, string>): Promise<RefreshOutcome> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...forwarded },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!response.ok) return { status: 'rejected' };
    const auth = (await response.json()) as AuthResponse;
    return auth.tokens ? { status: 'ok', auth: auth as SignedInResponse } : { status: 'rejected' };
  } catch {
    return { status: 'unreachable' };
  }
}
