import { NextResponse } from 'next/server';
import { API_URL, PUBLIC_API_URL } from '@/lib/config';
import { getSessionToken, refreshCurrentSession } from '@/lib/session';

/**
 * Exchanges the session for a two-minute realtime ticket the browser can hand to the SignalR hub. The session
 * token itself never reaches page scripts; the ticket is only accepted by the hub.
 */
export async function POST() {
  let response = await requestTicket(await getSessionToken());
  if (response?.status === 401) {
    const renewed = await refreshCurrentSession();
    response = renewed ? await requestTicket(renewed) : null;
  }
  if (!response?.ok) return NextResponse.json({ error: 'No session' }, { status: 401 });

  const { ticket, hubPath } = (await response.json()) as { ticket: string; hubPath: string };
  return NextResponse.json({ ticket, url: `${PUBLIC_API_URL}${hubPath}` }, { headers: { 'Cache-Control': 'no-store' } });
}

async function requestTicket(token: string | undefined) {
  if (!token) return null;
  return fetch(`${API_URL}/api/realtime/ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);
}
