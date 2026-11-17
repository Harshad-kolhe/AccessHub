'use client';

import { useEffect, useState, useTransition } from 'react';
import { LogOutIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { revokeSession, signOutEverywhere } from './actions';

export function SignOutDeviceButton({ sessionId, device }: { sessionId: string; device: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeSession(sessionId);
          if (result.ok) toast.success(`Signed out ${device}`);
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Spinner /> : <LogOutIcon />}
      Sign out
    </Button>
  );
}

export function SignOutEverywhereButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <LogOutIcon />
        Sign out everywhere
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out of every device?"
        description={
          <>
            <p>
              {count > 1 ? `All ${count} sessions end` : 'Your session ends'}, this one included. Access tokens stop working at once, not when
              they expire.
            </p>
            <p>Use it if you think someone else has your password, then change it.</p>
          </>
        }
        confirmLabel="Sign out everywhere"
        onConfirm={signOutEverywhere}
      />
    </>
  );
}

function remaining(until: number, now: number) {
  const seconds = Math.max(0, Math.floor((until - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Shows the access token running down. When it is about to expire, the next request renews it with the
 * refresh token (rotated each time), so the session continues without signing in again.
 */
export function TokenCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const left = now === null ? null : expiresAt - now;
  return (
    <span className="font-heading text-3xl leading-none font-semibold tabular" aria-live="off">
      {left === null ? '–:––' : left > 0 ? remaining(expiresAt, now!) : 'renews on your next click'}
    </span>
  );
}
