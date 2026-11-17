import { NextResponse, type NextRequest } from 'next/server';
import { PATH_HEADER, REFRESH_COOKIE, SESSION_COOKIE, isSessionTokenUsable } from '@/lib/jwt';
import { clearSessionCookies, forwardedFor, requestRefresh, writeSessionCookies, type RefreshOutcome } from '@/lib/session-cookies';

/**
 * Runs before any rendering. It renews an access token that is about to expire (Server Components cannot set
 * cookies, so this is the place to do it), and keeps signed-out visitors out of the console. It is a convenience,
 * not the security boundary: the .NET API validates the token and the permission on every call.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = request.cookies.get(SESSION_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const inConsole = pathname === '/app' || pathname.startsWith('/app/');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATH_HEADER, pathname + search);

  // Renew a minute early, so a token never expires halfway through rendering a page.
  let outcome: RefreshOutcome | null = null;
  if (!isSessionTokenUsable(access, 60_000) && refreshToken) {
    outcome = await requestRefresh(refreshToken, forwardedFor(request.headers));
    if (outcome.status === 'ok') {
      // This request renders with the new tokens; the response stores them in the browser.
      setRequestCookies(requestHeaders, {
        [SESSION_COOKIE]: outcome.auth.tokens.accessToken,
        [REFRESH_COOKIE]: outcome.auth.tokens.refreshToken,
      });
    }
  }

  const signedIn = isSessionTokenUsable(access) || outcome?.status === 'ok';
  // If the API is down, let the page render its "API unreachable" state instead of signing the user out.
  const mayContinue = signedIn || outcome?.status === 'unreachable';

  let response: NextResponse;
  if (inConsole && !mayContinue) {
    const login = new URL('/login', request.url);
    if (access || refreshToken) login.searchParams.set('reason', 'expired');
    if (pathname !== '/app') login.searchParams.set('next', pathname + search);
    response = NextResponse.redirect(login);
  } else if ((pathname === '/login' || pathname === '/register') && signedIn) {
    response = NextResponse.redirect(new URL('/app', request.url));
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (outcome?.status === 'ok') writeSessionCookies(response.cookies, outcome.auth.tokens);
  else if (outcome?.status === 'rejected' || (!signedIn && access && !refreshToken)) clearSessionCookies(response.cookies);
  return response;
}

function setRequestCookies(headers: Headers, values: Record<string, string>) {
  const jar = new Map<string, string>();
  for (const pair of (headers.get('cookie') ?? '').split(';')) {
    const index = pair.indexOf('=');
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
  for (const [name, value] of Object.entries(values)) jar.set(name, value);
  headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
}

export const config = {
  matcher: ['/app/:path*', '/login', '/register'],
};
