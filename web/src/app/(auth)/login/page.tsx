import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, PUBLIC_API_URL } from '@/lib/config';
import { DemoBadges } from './demo-badges';
import { LoginForm, type SignInProvider } from './login-form';
import { SignInNotice } from './session-expired-notice';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell
      aside={
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">Sign in with a demo badge</h2>
          <p className="mt-3 mb-8 max-w-md text-sidebar-foreground">
            Each account sees a different console. Calling the API directly hits the same limits.
          </p>
          <DemoBadges />
        </div>
      }
    >
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">Use your email and password, or pick a demo badge.</p>
      {/* These read the URL, so they stream in after the prerendered shell. */}
      <Suspense fallback={null}>
        <SignInNotice />
      </Suspense>
      <Suspense fallback={<FormSkeleton />}>
        <SignInMethods />
      </Suspense>
      <p className="mt-8 text-sm text-muted-foreground">
        New to AccessHub?{' '}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
          Create an organization
        </Link>
      </p>
    </AuthShell>
  );
}

/** Google and Microsoft buttons appear only when the API has credentials for them. */
async function SignInMethods() {
  let providers: SignInProvider[] = [];
  try {
    const response = await fetch(`${API_URL}/api/auth/providers`, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const list = (await response.json()) as { name: string; displayName: string }[];
      providers = list.map((provider) => ({ ...provider, href: `${PUBLIC_API_URL}/api/auth/external/${provider.name}` }));
    }
  } catch {
    // API down or slow: password sign-in still renders, and reports the problem when used.
  }
  return <LoginForm providers={providers} />;
}

function FormSkeleton() {
  return (
    <div className="mt-8 grid gap-6" aria-busy="true" aria-label="Loading">
      {[0, 1].map((row) => (
        <div key={row} className="grid gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
