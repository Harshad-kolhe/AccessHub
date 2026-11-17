import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { AcceptInviteForm } from '@/components/auth/credential-forms';

export const metadata: Metadata = { title: 'Accept your invitation' };

export default function AcceptInvitePage() {
  return (
    <AuthShell
      aside={
        <div className="max-w-md">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">You’re invited</h2>
          <p className="mt-3 text-sidebar-foreground">
            Your account is ready, with the roles your admin picked. Set a password to finish. The link works once, for three
            days.
          </p>
          <p className="mt-6 text-sm text-sidebar-foreground">Afterwards you can turn on two-factor sign-in from your account page.</p>
        </div>
      }
    >
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Set your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">Then you’ll go straight to the console.</p>
      <Suspense fallback={null}>
        <AcceptInviteForm />
      </Suspense>
    </AuthShell>
  );
}
