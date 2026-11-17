import { NextResponse, type NextRequest } from 'next/server';
import { API_URL } from '@/lib/config';
import { getSessionToken, refreshCurrentSession } from '@/lib/session';
import { auditQuery } from '../filters';

/** Streams the API's CSV export of the filtered audit log to the browser as a download. */
export async function GET(request: NextRequest) {
  const query = auditQuery(Object.fromEntries(request.nextUrl.searchParams));
  let response = await download(query, await getSessionToken());
  if (response?.status === 401) {
    const renewed = await refreshCurrentSession();
    response = renewed ? await download(query, renewed) : null;
  }
  if (!response) return NextResponse.json({ error: 'The AccessHub API is not reachable.' }, { status: 502 });
  if (!response.ok) return new NextResponse(response.body, { status: response.status, headers: { 'Content-Type': 'application/problem+json' } });

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': response.headers.get('Content-Disposition') ?? 'attachment; filename="accesshub-audit.csv"',
      'Cache-Control': 'no-store',
    },
  });
}

function download(query: string, token: string | undefined) {
  if (!token) return Promise.resolve(null);
  return fetch(`${API_URL}/api/audit/export${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null);
}
