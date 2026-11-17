import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from '@/components/auth/credential-forms';
import { RecoveryAside } from '@/components/auth/recovery-aside';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <AuthShell aside={<RecoveryAside />}>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">Every device signed in to this account will be signed out.</p>
      {/* Reads the email and token from the link. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
