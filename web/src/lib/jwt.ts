/** httpOnly cookie with the API's short-lived access token (15 minutes). */
export const SESSION_COOKIE = 'accesshub_token';
/** httpOnly cookie with the rotating refresh token that renews the access token (7 days, sliding). */
export const REFRESH_COOKIE = 'accesshub_refresh';
/** httpOnly cookie holding the two-factor challenge between the password step and the code step (5 minutes). */
export const CHALLENGE_COOKIE = 'accesshub_2fa';
/** Set for a few seconds after a refresh, so a token the API still rejects can't cause a refresh loop. */
export const REFRESHED_COOKIE = 'accesshub_refreshed';
/** Request header the proxy adds so Server Components know the path to come back to after a refresh. */
export const PATH_HEADER = 'x-accesshub-path';

/**
 * Reads the token's `exp` claim WITHOUT verifying its signature. That is fine for what it is used for here
 * (cookie lifetime and "renew now?" decisions); the API verifies the signature on every request.
 */
export function getTokenExpiry(token: string): Date | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp === 'number' ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

/** True when there is a token that is still valid `marginMs` from now. */
export function isSessionTokenUsable(token: string | undefined, marginMs = 0): token is string {
  const expiry = token ? getTokenExpiry(token) : null;
  return expiry !== null && expiry.getTime() - marginMs > Date.now();
}

/** Only same-site paths are allowed as a post-sign-in destination (no open redirects). */
export function safeNext(value: string | null | undefined, fallback = '/app'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
