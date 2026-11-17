import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/credential-forms';
import { RecoveryAside } from '@/components/auth/recovery-aside';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell aside={<RecoveryAside />}>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">We’ll email you a link to choose a new one.</p>
      <ForgotPasswordForm />
      <p className="mt-8 text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
