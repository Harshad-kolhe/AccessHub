'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr';
import { toast } from 'sonner';
import { syncSession } from '@/app/app/actions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Status = 'connecting' | 'live' | 'reconnecting' | 'offline';

const STATUS_TEXT: Record<Status, { label: string; help: string }> = {
  connecting: { label: 'Connecting', help: 'Connecting to live updates.' },
  live: { label: 'Live', help: 'Changes other people make show up here without reloading.' },
  reconnecting: { label: 'Reconnecting', help: 'Lost the live connection; trying again.' },
  offline: { label: 'Offline', help: 'Live updates are off. Reload the page to see the latest changes.' },
};

async function fetchTicket(): Promise<{ ticket: string; url: string }> {
  const response = await fetch('/auth/ticket', { method: 'POST' });
  if (!response.ok) throw new Error('No realtime ticket');
  return response.json();
}

/**
 * Keeps a SignalR connection to the API's notification hub. Messages only say that something changed; the page
 * re-renders through Next.js with the user's own permissions. The hub accepts short-lived tickets, so the
 * session token never reaches the browser.
 */
export function RealtimeBridge({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let connection: HubConnection | null = null;
    let cancelled = false;
    let timer: number | undefined;
    const refreshSoon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 500);
    };

    (async () => {
      try {
        const first = await fetchTicket();
        if (cancelled) return;
        let unused: string | null = first.ticket;
        connection = new HubConnectionBuilder()
          .withUrl(first.url, {
            withCredentials: false,
            // Called on every (re)connect; tickets last two minutes, so fetch a fresh one each time.
            accessTokenFactory: async () => {
              if (unused) {
                const ticket = unused;
                unused = null;
                return ticket;
              }
              return (await fetchTicket()).ticket;
            },
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
          .configureLogging(LogLevel.Warning)
          .build();

        connection.on('permissionsChanged', async ({ reason }: { reason: string }) => {
          toast.info(reason, { description: 'Your access was updated, and this page now reflects it.' });
          await syncSession();
          router.refresh();
        });
        connection.on('accessRequestCreated', ({ requesterUserId, requesterName, roleName }: { requesterUserId: string; requesterName: string; roleName: string }) => {
          if (requesterUserId === userId) return;
          toast(`${requesterName} asked for ${roleName}`, {
            description: 'Approve or decline it on the access requests page.',
            action: { label: 'Review', onClick: () => router.push('/app/access-requests') },
          });
          refreshSoon();
        });
        connection.on('accessRequestDecided', ({ approved, roleName }: { approved: boolean; roleName: string }) => {
          // Approvals also send permissionsChanged, which announces them.
          if (!approved) toast.error(`Your request for ${roleName} was declined`, { description: 'The access requests page has the approver’s note.' });
          refreshSoon();
        });
        connection.on('auditEventsRecorded', () => {
          const path = pathRef.current;
          if (path === '/app' || path.startsWith('/app/audit') || path.startsWith('/app/access-requests')) refreshSoon();
        });

        connection.onreconnecting(() => setStatus('reconnecting'));
        connection.onreconnected(() => setStatus('live'));
        connection.onclose(() => {
          if (!cancelled) setStatus('offline');
        });
        await connection.start();
        if (!cancelled) setStatus('live');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void connection?.stop();
    };
  }, [router, userId]);

  const text = STATUS_TEXT[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          tabIndex={0}
          className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              status === 'live' && 'bg-granted shadow-[0_0_0_3px_var(--granted-soft)]',
              status === 'reconnecting' && 'animate-pulse bg-band-amber',
              (status === 'connecting' || status === 'offline') && 'bg-muted-foreground/50',
            )}
          />
          {text.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{text.help}</TooltipContent>
    </Tooltip>
  );
}
