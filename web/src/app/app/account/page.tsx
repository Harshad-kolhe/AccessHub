import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MonitorSmartphoneIcon } from 'lucide-react';
import { ApiErrorNotice, RoleBadge } from '@/components/access';
import { PageHeader } from '@/components/page-header';
import { Panel } from '@/components/panel';
import { PanelSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { requestTime } from '@/lib/clock';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { getTokenExpiry } from '@/lib/jwt';
import { PermissionCodes, hasPermission } from '@/lib/permissions';
import { getSessionToken } from '@/lib/session';
import type { Session, TwoFactorStatus, User } from '@/lib/types';
import { describeDevice } from '@/lib/user-agent';
import { SignOutDeviceButton, SignOutEverywhereButton, TokenCountdown } from './session-controls';
import { TwoFactorCard } from './two-factor-card';

export const metadata: Metadata = { title: 'Account and security' };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account and security" description="Two-factor sign-in, the devices you’re signed in on, and how your session renews." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Suspense fallback={<PanelSkeleton />}>
            <TwoFactor />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <Sessions />
          </Suspense>
        </div>
        <div className="grid content-start gap-6">
          <Suspense fallback={<PanelSkeleton />}>
            <SessionTiming />
          </Suspense>
          <Suspense fallback={<PanelSkeleton />}>
            <Profile />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function TwoFactor() {
  const [user, status] = await Promise.all([getCurrentUser(), apiGet<TwoFactorStatus>('/api/account/two-factor')]);
  return (
    <Panel title="Two-factor sign-in" description="A second step after your password, with an authenticator app.">
      {status.ok ? (
        <TwoFactorCard enabled={status.data.enabled} recoveryCodesLeft={status.data.recoveryCodesLeft} email={user.email} />
      ) : (
        <ApiErrorNotice message={status.error} />
      )}
    </Panel>
  );
}

async function Sessions() {
  const sessions = await apiGet<Session[]>('/api/account/sessions');
  if (!sessions.ok) return <ApiErrorNotice message={sessions.error} />;
  const now = requestTime();

  return (
    <Panel
      title="Where you’re signed in"
      description="Each sign-in is a session with its own rotating refresh token. Signing one out ends it at once."
      action={<SignOutEverywhereButton count={sessions.data.length} />}
    >
      <ul className="grid gap-3">
        {sessions.data.map((session) => {
          const device = describeDevice(session.userAgent);
          return (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <MonitorSmartphoneIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {device}
                    {session.isCurrent && <Badge variant="outline" className="border-brand/40 font-normal text-brand">This device</Badge>}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {session.ipAddress ?? 'Unknown address'}, signed in {formatRelative(session.startedAtUtc, now)}
                  </p>
                  <p className="text-xs text-muted-foreground" title={formatDateTime(session.lastActiveAtUtc)}>
                    Last renewed {formatRelative(session.lastActiveAtUtc, now)}, ends by {formatDate(session.expiresAtUtc)} if unused
                  </p>
                </div>
              </div>
              {!session.isCurrent && <SignOutDeviceButton sessionId={session.id} device={device} />}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

async function SessionTiming() {
  const token = await getSessionToken();
  const expiry = token ? getTokenExpiry(token) : null;
  return (
    <Panel title="Your access token" description="Short-lived on purpose: if one leaks, it stops working within minutes.">
      <div className="grid gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Expires in</p>
          <div className="mt-1.5">{expiry ? <TokenCountdown expiresAt={expiry.getTime()} /> : <span className="text-sm">No token</span>}</div>
        </div>
        <ul className="grid gap-2 text-sm text-muted-foreground">
          <li>Access tokens last 15 minutes. This server renews them with a refresh token, which rotates on every use.</li>
          <li>A refresh token used twice means it was copied: the whole session is revoked.</li>
          <li>Role changes take effect at once: the old token is rejected, and the renewed one carries the new permissions.</li>
        </ul>
      </div>
    </Panel>
  );
}

async function Profile() {
  const user = await getCurrentUser();
  const me = hasPermission(user, PermissionCodes.UsersRead) && user.organizationId ? await apiGet<User>(`/api/users/${user.id}`) : null;
  return (
    <Panel title="You">
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{user.fullName}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{user.email}</dd>
        <dt className="text-muted-foreground">Organization</dt>
        <dd>{user.organizationName ?? 'Every organization (super admin)'}</dd>
        <dt className="text-muted-foreground">Permissions</dt>
        <dd>{user.isSuperAdmin ? 'All of them' : user.permissions.length}</dd>
        {me?.ok && (
          <>
            <dt className="text-muted-foreground">Roles</dt>
            <dd className="flex flex-wrap gap-1.5">
              {me.data.roles.length > 0 ? me.data.roles.map((role) => <RoleBadge key={role.roleId} name={role.roleName} expiresAtUtc={role.expiresAtUtc} />) : 'None'}
            </dd>
          </>
        )}
      </dl>
    </Panel>
  );
}
