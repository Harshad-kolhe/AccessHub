import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { PERMISSION_CATALOG } from '@/lib/permissions';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Create an organization' };

const organizationPermissions = PERMISSION_CATALOG.filter((permission) => !permission.platform);

export default function RegisterPage() {
  return (
    <AuthShell
      aside={
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">Start your own organization</h2>
          <p className="mt-3 max-w-md text-sidebar-foreground">
            You become its first admin. Your OrgAdmin role grants every organization permission:
          </p>
          <ul className="mt-6 grid max-w-md gap-1.5">
            {organizationPermissions.map((permission) => (
              <li key={permission.code} className="flex items-center justify-between gap-4 rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="text-white/90">{permission.label}</span>
                <code className="font-mono text-xs text-sidebar-foreground">{permission.code}</code>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-md text-sm text-sidebar-foreground">
            <code className="font-mono text-xs text-white/90">organizations.manage</code> stays with super admins, so no
            organization can reach another one.
          </p>
        </div>
      }
    >
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Create an organization</h1>
      <p className="mt-2 text-sm text-muted-foreground">It takes a minute, and you can invite people afterwards.</p>
      <RegisterForm />
      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4 hover:text-brand">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
