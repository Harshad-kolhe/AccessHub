import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, cache } from 'react';
import { CircleAlertIcon, ClockIcon } from 'lucide-react';
import { ApiErrorNotice, BandMarker, PermissionCode, StatusDot, roleBand } from '@/components/access';
import { PageHeader } from '@/components/page-header';
import { Panel, StatTile, TableView } from '@/components/panel';
import { PanelSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { requestTime } from '@/lib/clock';
import { formatDateTime, formatRelative, formatUntil } from '@/lib/format';
import { PERMISSION_CATALOG, PermissionCodes, hasPermission } from '@/lib/permissions';
import type { AccessRequest, AuditEvent, Insights, Paged } from '@/lib/types';
import { capitalize, describeAuditEvent } from './audit/describe';
import { ChangesChart, SignInsChart } from './dashboard-charts';

export const metadata: Metadata = { title: 'Dashboard' };

/** One API call feeds every section; React's cache shares it across the Suspense boundaries below. */
const getInsights = cache(() => apiGet<Insights>('/api/insights?days=14'));

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Who has access, what changed, and what is waiting for a decision." />
      <Suspense fallback={<TilesSkeleton />}>
        <Tiles />
      </Suspense>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Suspense fallback={<PanelSkeleton className="lg:col-span-2" />}>
          <SignIns />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <NeedsAttention />
        </Suspense>
        <Suspense fallback={<PanelSkeleton className="lg:col-span-2" />}>
          <Changes />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <PeoplePerRole />
        </Suspense>
        <Suspense fallback={<PanelSkeleton className="lg:col-span-2" />}>
          <RecentActivity />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <YourAccess />
        </Suspense>
      </div>
    </>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((tile) => (
        <div key={tile} className="rounded-xl border bg-card px-5 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-9 w-16" />
          <Skeleton className="mt-3 h-4 w-40" />
        </div>
      ))}
    </div>
  );
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

async function Tiles() {
  const insights = await getInsights();
  if (!insights.ok) return <ApiErrorNotice message={insights.error} />;
  const { counts, expiringSoon } = insights.data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {counts.users !== null && (
        <StatTile
          label="People"
          value={counts.users}
          context={`${counts.activeUsers} active, ${counts.usersWithTwoFactor} with two-factor sign-in`}
          href="/app/users"
        />
      )}
      {counts.roles !== null && (
        <StatTile
          label="Roles"
          value={counts.roles}
          context={
            expiringSoon && expiringSoon.length > 0
              ? `${plural(expiringSoon.length, 'temporary grant')} ending within 14 days`
              : 'No temporary grants ending soon'
          }
          href="/app/roles"
        />
      )}
      {counts.pendingAccessRequests !== null && (
        <StatTile
          label="Waiting for a decision"
          value={counts.pendingAccessRequests}
          context={counts.pendingAccessRequests === 0 ? 'No open access requests' : plural(counts.pendingAccessRequests, 'access request')}
          href="/app/access-requests"
        />
      )}
      {counts.signIns24h !== null && (
        <StatTile
          label="Sign-ins, last 24 hours"
          value={counts.signIns24h}
          context={
            counts.failedSignIns24h ? (
              <span className="inline-flex items-center gap-1.5 text-denied">
                <CircleAlertIcon className="size-3.5" aria-hidden="true" />
                {plural(counts.failedSignIns24h, 'failed attempt')}
              </span>
            ) : (
              'No failed attempts'
            )
          }
        />
      )}
    </div>
  );
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

async function SignIns() {
  const insights = await getInsights();
  const data = insights.ok ? insights.data.signInsPerDay : null;
  if (!data) return null;

  const failed = data.reduce((sum, d) => sum + d.failed, 0);
  const worst = data.reduce((max, d) => (d.failed > max.failed ? d : max), data[0]);
  return (
    <Panel
      className="lg:col-span-2"
      title="Sign-ins"
      description={
        failed > 0
          ? `${plural(failed, 'failed attempt')} in ${insights.ok ? insights.data.days : 14} days, most on ${day(worst.date)}.`
          : `Every sign-in in the last ${insights.ok ? insights.data.days : 14} days succeeded.`
      }
    >
      <SignInsChart data={data} />
      <TableView
        caption="Sign-ins per day"
        columns={['Day', 'Succeeded', 'Failed']}
        rows={data.map((d) => [day(d.date), d.succeeded, d.failed])}
      />
    </Panel>
  );
}

async function Changes() {
  const insights = await getInsights();
  const data = insights.ok ? insights.data.changesPerDay : null;
  if (!data) return null;

  const totals = data.reduce(
    (sum, d) => ({ granted: sum.granted + d.granted, revoked: sum.revoked + d.revoked }),
    { granted: 0, revoked: 0 },
  );
  return (
    <Panel
      className="lg:col-span-2"
      title="Access changes"
      description={`${plural(totals.granted, 'grant')} and ${plural(totals.revoked, 'removal')} in the audit log, plus everything else that changed.`}
      action={
        <Link href="/app/audit" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Open audit log
        </Link>
      }
    >
      <ChangesChart data={data} />
      <TableView
        caption="Audit events per day by kind"
        columns={['Day', 'Granted', 'Removed', 'Other', 'Security']}
        rows={data.map((d) => [day(d.date), d.granted, d.revoked, d.changed, d.security])}
      />
    </Panel>
  );
}

/** One series, so one color: the role's clearance band rides beside its name, not on the bar. */
async function PeoplePerRole() {
  const insights = await getInsights();
  const roles = insights.ok ? insights.data.usersPerRole : null;
  if (!roles) return null;

  const max = Math.max(1, ...roles.map((role) => role.users));
  return (
    <Panel title="People per role" description="Who holds each role right now, temporary grants included.">
      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No roles yet.</p>
      ) : (
        <ul className="grid gap-3">
          {roles.map((role) => (
            <li key={role.roleId} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2" title={role.organization ? `${role.role}, ${role.organization}` : role.role}>
                <BandMarker band={roleBand(role.role)} />
                <span className="truncate">
                  {role.role}
                  {role.organization && <span className="text-muted-foreground"> {role.organization}</span>}
                </span>
              </span>
              <span className="h-3 rounded-r-[4px] bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(role.users / max) * 100}%` }} aria-hidden="true" />
              <span className="text-right tabular">{role.users}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function NeedsAttention() {
  const user = await getCurrentUser();
  const canApprove = hasPermission(user, PermissionCodes.UsersWrite);
  const [insights, pending] = await Promise.all([
    getInsights(),
    canApprove ? apiGet<AccessRequest[]>('/api/access-requests?scope=pending') : null,
  ]);
  const expiring = insights.ok ? (insights.data.expiringSoon ?? []) : [];
  const requests = pending?.ok ? pending.data.filter((request) => request.requesterUserId !== user.id).slice(0, 3) : [];
  const now = requestTime();

  return (
    <Panel title="Needs attention" description={canApprove ? 'Requests to decide and access that ends soon.' : 'Temporary access that ends soon.'}>
      {requests.length === 0 && expiring.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is waiting for you.</p>
      ) : (
        <div className="grid gap-5">
          {requests.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Access requests</h3>
              <ul className="mt-2 grid gap-2">
                {requests.map((request) => (
                  <li key={request.id}>
                    <Link
                      href="/app/access-requests"
                      className="block rounded-lg border px-3 py-2.5 transition-colors outline-none hover:border-brand/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{request.requesterName}</span>
                        <span className="text-xs text-muted-foreground">{formatRelative(request.createdAtUtc, now)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        wants <BandMarker band={roleBand(request.roleName)} />
                        <span className="text-foreground">{request.roleName}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">“{request.reason}”</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {expiring.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Temporary access ending</h3>
              <ul className="mt-2 grid gap-2">
                {expiring.map((grant) => (
                  <li key={`${grant.userId}-${grant.roleId}`} className="flex items-start gap-2.5 text-sm">
                    <ClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>
                      <span className="font-medium">{grant.userName}</span>
                      <span className="text-muted-foreground"> loses </span>
                      {grant.roleName}
                      <span className="block text-xs text-muted-foreground" title={formatDateTime(grant.expiresAtUtc)}>
                        {formatUntil(grant.expiresAtUtc, now)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

async function RecentActivity() {
  const user = await getCurrentUser();
  if (!hasPermission(user, PermissionCodes.AuditRead)) {
    return (
      <Panel className="lg:col-span-2" title="Recent activity">
        <p className="text-sm text-muted-foreground">
          Seeing changes needs <PermissionCode code={PermissionCodes.AuditRead} />.
        </p>
      </Panel>
    );
  }

  const events = await apiGet<Paged<AuditEvent>>('/api/audit?pageSize=7');
  const now = requestTime();
  return (
    <Panel
      className="lg:col-span-2"
      title="Recent activity"
      description="From the audit log, newest first."
      action={
        <Link href="/app/audit" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Open audit log
        </Link>
      }
    >
      {!events.ok || events.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{events.ok ? 'Nothing has changed yet.' : events.error}</p>
      ) : (
        <ol>
          {events.data.items.map((event, index) => {
            const { phrase } = describeAuditEvent(event);
            const actor = event.actorUserId === user.id ? 'You' : event.actorName;
            return (
              <li key={event.id} className="relative flex gap-4 pb-4 last:pb-0">
                {index < events.data.items.length - 1 && <span aria-hidden="true" className="absolute top-3 left-[5px] h-full w-px bg-border" />}
                <span aria-hidden="true" className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-brand bg-card" />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{actor}</span> {phrase}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <time dateTime={event.createdAtUtc} title={formatDateTime(event.createdAtUtc)}>
                      {capitalize(formatRelative(event.createdAtUtc, now))}
                    </time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

async function YourAccess() {
  const user = await getCurrentUser();
  const granted = PERMISSION_CATALOG.filter((permission) => hasPermission(user, permission.code)).length;

  return (
    <Panel
      title="Your access"
      description={user.isSuperAdmin ? 'Super admins hold every permission, everywhere.' : `${granted} of ${PERMISSION_CATALOG.length} permissions, from your roles.`}
      bodyClassName="px-0 py-1"
    >
      <ul className="divide-y">
        {PERMISSION_CATALOG.map((permission) => {
          const has = hasPermission(user, permission.code);
          return (
            <li key={permission.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2">
              <StatusDot on={has} />
              <span className={has ? 'text-sm' : 'text-sm text-muted-foreground'}>{permission.label}</span>
              <PermissionCode code={permission.code} className={has ? 'ml-auto' : 'ml-auto opacity-55'} />
            </li>
          );
        })}
      </ul>
      {!user.isSuperAdmin && granted < PERMISSION_CATALOG.length - 1 && (
        <div className="border-t px-5 py-3">
          <Link href="/app/access-requests?new=1" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Request more access
          </Link>
        </div>
      )}
    </Panel>
  );
}
