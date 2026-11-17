import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/config';
import { CHALLENGE_COOKIE } from '@/lib/jwt';
import { cookieOptions, forwardedFor, writeSessionCookies } from '@/lib/session-cookies';
import type { AuthResponse } from '@/lib/types';

/**
 * Google or Microsoft sent the browser back to the API, which redirected here with a one-time code. The code is
 * exchanged server-to-server, so tokens never appear in a URL.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const fail = () => NextResponse.redirect(new URL('/login?error=external', request.url));
  if (!code) return fail();

  const response = await fetch(`${API_URL}/api/auth/external/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forwardedFor(request.headers) },
    body: JSON.stringify({ code }),
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) return fail();

  const auth = (await response.json()) as AuthResponse;
  if (auth.requiresTwoFactor && auth.challengeToken) {
    const twoFactor = NextResponse.redirect(new URL('/login?step=two-factor', request.url));
    twoFactor.cookies.set(CHALLENGE_COOKIE, auth.challengeToken, cookieOptions({ maxAge: 5 * 60 }));
    return twoFactor;
  }
  if (!auth.tokens) return fail();

  const signedIn = NextResponse.redirect(new URL('/app', request.url));
  writeSessionCookies(signedIn.cookies, auth.tokens);
  return signedIn;
}
