import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL } from './config';
import { PATH_HEADER, REFRESHED_COOKIE, SESSION_COOKIE } from './jwt';
import { getSessionToken, refreshCurrentSession } from './session';
import { tokenTag } from './session-cookies';
import type { ActionResult } from './types';

export const API_UNREACHABLE = 'The AccessHub API is not reachable. Check that it is running.';

const SESSION_EXPIRED = '/login?reason=expired';

/** RFC 9457 problem details, as every API error is shaped (validation problems add `errors`). */
interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

/**
 * Turns an error response into a message for the user: the problem's `detail`, else its validation messages,
 * else the fallback. Problem titles are generic ("Forbidden"), so they are not shown on their own.
 */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;
  if (!problem || typeof problem !== 'object') return fallback;
  if (problem.detail) return problem.detail;

  const fieldErrors = Object.values(problem.errors ?? {}).flat();
  return fieldErrors.length ? fieldErrors.join(' ') : fallback;
}

export type ApiReadResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/**
 * GET for Server Components. A rejected token (expired, or revoked because the user's roles changed) sends the
 * browser through /auth/refresh, which renews the session and comes straight back; Server Components cannot set
 * cookies themselves. A 403 or other API error is returned for the page to render. If the API cannot be
 * reached, fetch throws and the route's error.tsx handles it.
 */
export async function apiGet<T>(path: string): Promise<ApiReadResult<T>> {
  const token = await getSessionToken();
  if (!token) await renewAndReturn();

  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (response.status === 401) await renewAndReturn();
  if (response.status === 403) {
    return { ok: false, status: 403, error: await readApiError(response, 'You do not have permission to view this.') };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, error: await readApiError(response, `The API returned HTTP ${response.status}.`) };
  }

  return { ok: true, data: (await response.json()) as T };
}

async function renewAndReturn(): Promise<never> {
  // The token /auth/refresh just issued is rejected too: the session is over, so don't loop.
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && jar.get(REFRESHED_COOKIE)?.value === tokenTag(token)) redirect(SESSION_EXPIRED);
  const path = (await headers()).get(PATH_HEADER) ?? '/app';
  redirect(`/auth/refresh?next=${encodeURIComponent(path)}`);
}

async function send(path: string, method: string, body: unknown, token: string | undefined): Promise<Response | null> {
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}

/**
 * POST/PUT/DELETE for Server Actions. On a 401 the session is renewed once (actions may set cookies) and the
 * call retried, so a token revoked by a role change never surfaces as an error. The parsed body, if any, is
 * returned as `data`.
 */
export async function apiSend<T = undefined>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown,
  fallback: string,
): Promise<ActionResult<T>> {
  let response = await send(path, method, body, await getSessionToken());
  if (response?.status === 401) {
    const renewed = await refreshCurrentSession();
    if (!renewed) redirect(SESSION_EXPIRED);
    response = await send(path, method, body, renewed);
    if (response?.status === 401) redirect(SESSION_EXPIRED);
  }

  if (!response) return { ok: false, error: API_UNREACHABLE };
  if (response.status === 403) return { ok: false, error: await readApiError(response, "You don't have permission to do that.") };
  if (!response.ok) return { ok: false, error: await readApiError(response, fallback) };

  const text = await response.text();
  return { ok: true, data: text ? (JSON.parse(text) as T) : undefined };
}

/** For anonymous endpoints (sign-in, recovery): the response itself, or null when the API is unreachable. */
export async function apiPostAnonymous(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<Response | null> {
  try {
    return await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return null;
  }
}
