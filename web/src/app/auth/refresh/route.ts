import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE, safeNext } from '@/lib/jwt';
import { clearSessionCookies, forwardedFor, markRenewedToken, requestRefresh, writeSessionCookies } from '@/lib/session-cookies';

/**
 * A page's API call was rejected (the token expired, or was revoked because the user's roles changed). Server
 * Components can't set cookies, so they send the browser here: renew the session, then go straight back.
 */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const outcome = refreshToken ? await requestRefresh(refreshToken, forwardedFor(request.headers)) : ({ status: 'rejected' } as const);

  if (outcome.status === 'ok') {
    const response = NextResponse.redirect(new URL(next, request.url));
    writeSessionCookies(response.cookies, outcome.auth.tokens);
    markRenewedToken(response.cookies, outcome.auth.tokens.accessToken);
    return response;
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('reason', outcome.status === 'unreachable' ? 'unavailable' : 'expired');
  if (next !== '/app') login.searchParams.set('next', next);
  const response = NextResponse.redirect(login);
  if (outcome.status === 'rejected') clearSessionCookies(response.cookies);
  return response;
}
