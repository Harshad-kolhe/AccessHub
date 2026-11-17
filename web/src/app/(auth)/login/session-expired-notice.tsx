'use client';

import { useSearchParams } from 'next/navigation';
import { CircleAlertIcon, InfoIcon, KeyRoundIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const NOTICES: Record<string, { text: string; tone: 'info' | 'success' | 'error' }> = {
  expired: { text: 'Your session ended. Sign in again to continue.', tone: 'info' },
  unavailable: { text: 'The AccessHub API is not reachable right now. Try again in a moment.', tone: 'error' },
  'password-reset': { text: 'Your password was changed and every device was signed out. Sign in with the new password.', tone: 'success' },
  'signed-out-everywhere': { text: 'You signed out of every device. Sign in again to continue here.', tone: 'success' },
  external: { text: 'Signing in with that provider didn’t work. Try again, or use your email and password.', tone: 'error' },
  external_no_account: {
    text: 'There is no AccessHub account for that email. Ask an admin for an invitation first.',
    tone: 'error',
  },
};

/** Explains why the user landed on the sign-in page (see the redirects in the proxy, lib/api.ts and /auth/*). */
export function SignInNotice() {
  const params = useSearchParams();
  const notice = NOTICES[params.get('reason') ?? params.get('error') ?? ''];
  if (!notice) return null;

  const Icon = notice.tone === 'error' ? CircleAlertIcon : notice.tone === 'success' ? KeyRoundIcon : InfoIcon;
  return (
    <Alert className="mt-6" variant={notice.tone === 'error' ? 'destructive' : 'default'}>
      <Icon />
      <AlertDescription>
        <p>{notice.text}</p>
      </AlertDescription>
    </Alert>
  );
}
