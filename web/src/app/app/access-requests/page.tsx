import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { InboxIcon } from 'lucide-react';
import { ApiErrorNotice, BandMarker, PermissionCode, roleBand } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Panel } from '@/components/panel';
import { PanelSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { requestTime } from '@/lib/clock';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { PERMISSION_CATALOG, PermissionCodes, hasPermission } from '@/lib/permissions';
import type { AccessRequest, AccessRequestStatus, RoleOption, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DecisionButtons, RequestAccessDialog, WithdrawButton } from './request-dialogs';

export const metadata: Metadata = { title: 'Access requests' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AccessRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Access requests"
        description="Ask for a role when you need more access. Admins who can grant it approve, with an end date if it’s temporary."
        action={
          <Suspense fallback={null}>
            <RequestButton searchParams={searchParams} />
          </Suspense>
        }
      />
      <div className="grid gap-6">
        <Suspense fallback={<PanelSkeleton />}>
          <Waiting />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <Mine />
        </Suspense>
        <Suspense fallback={null}>
          <Decided />
        </Suspense>
      </div>
    </>
  );
}

async function RequestButton({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (user.isSuperAdmin || !user.organizationId) return null;

  const [options, me, params] = await Promise.all([
    apiGet<RoleOption[]>('/api/access-requests/options'),
    hasPermission(user, PermissionCodes.UsersRead) ? apiGet<User>(`/api/users/${user.id}`) : null,
    searchParams,
  ]);
  const missing = PERMISSION_CATALOG.filter((permission) => !permission.platform && !hasPermission(user, permission.code));
  const permission = typeof params.permission === 'string' ? params.permission : undefined;
  return (
    <RequestAccessDialog
      roles={options.ok ? options.data : []}
      missingPermissions={missing}
      heldRoleIds={me?.ok ? me.data.roles.map((role) => role.roleId) : []}
      defaultOpen={params.new === '1'}
      defaultPermission={permission}
    />
  );
}

const STATUS: Record<AccessRequestStatus, { label: string; className: string }> = {
  Pending: { label: 'Waiting', className: 'border-band-amber/40 text-foreground' },
  Approved: { label: 'Approved', className: 'border-granted/40 text-granted' },
  Rejected: { label: 'Declined', className: 'border-denied/40 text-denied' },
  Cancelled: { label: 'Withdrawn', className: 'text-muted-foreground' },
};

function RequestCard({ request, now, children, showRequester }: { request: AccessRequest; now: number; children?: ReactNode; showRequester: boolean }) {
  const status = STATUS[request.status];
  return (
    <li className="rounded-lg border px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            {showRequester && <span className="font-medium">{request.requesterName}</span>}
            <span className="text-muted-foreground">{showRequester ? 'asked for' : 'You asked for'}</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <BandMarker band={roleBand(request.roleName)} />
              {request.roleName}
            </span>
            {request.permission && (
              <>
                <span className="text-muted-foreground">to get</span>
                <PermissionCode code={request.permission} />
              </>
            )}
          </p>
          <p className="mt-1.5 text-sm">“{request.reason}”</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <time dateTime={request.createdAtUtc} title={formatDateTime(request.createdAtUtc)}>
              {formatRelative(request.createdAtUtc, now)}
            </time>
            {request.decidedAtUtc && request.status !== 'Cancelled' && request.decidedByName && (
              <>
                {', '}
                {request.status === 'Approved' ? 'approved' : 'declined'} by {request.decidedByName}{' '}
                {formatRelative(request.decidedAtUtc, now)}
              </>
            )}
            {request.grantExpiresAtUtc && <>, access until {formatDate(request.grantExpiresAtUtc)}</>}
          </p>
          {request.decisionNote && (
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Note: </span>
              {request.decisionNote}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('font-normal', status.className)}>
            {status.label}
          </Badge>
          {children}
        </div>
      </div>
    </li>
  );
}

async function Waiting() {
  const user = await getCurrentUser();
  if (!hasPermission(user, PermissionCodes.UsersWrite) || !user.organizationId) return null;

  const requests = await apiGet<AccessRequest[]>('/api/access-requests?scope=pending');
  if (!requests.ok) return <ApiErrorNotice message={requests.error} />;
  const waiting = requests.data.filter((request) => request.requesterUserId !== user.id);
  const now = requestTime();

  return (
    <Panel
      title="Waiting for a decision"
      description={waiting.length === 0 ? 'Nothing to decide right now.' : 'You can’t decide your own requests, so they don’t appear here.'}
    >
      {waiting.length === 0 ? (
        <p className="text-sm text-muted-foreground">New requests appear here, and in a notification, as soon as they are sent.</p>
      ) : (
        <ul className="grid gap-3">
          {waiting.map((request) => (
            <RequestCard key={request.id} request={request} now={now} showRequester>
              <DecisionButtons request={request} />
            </RequestCard>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function Mine() {
  const user = await getCurrentUser();
  if (user.isSuperAdmin) {
    return <EmptyState icon={InboxIcon} title="Super admins hold every permission" description="There is nothing to request. Organization members ask for roles here." />;
  }

  const requests = await apiGet<AccessRequest[]>('/api/access-requests?scope=mine');
  if (!requests.ok) return <ApiErrorNotice message={requests.error} />;
  const now = requestTime();

  return (
    <Panel title="Your requests" description="What you asked for, and what happened.">
      {requests.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven’t asked for anything yet. When a page says you lack a permission, it links here.</p>
      ) : (
        <ul className="grid gap-3">
          {requests.data.map((request) => (
            <RequestCard key={request.id} request={request} now={now} showRequester={false}>
              {request.status === 'Pending' && <WithdrawButton request={request} />}
            </RequestCard>
          ))}
        </ul>
      )}
    </Panel>
  );
}

async function Decided() {
  const user = await getCurrentUser();
  if (!hasPermission(user, PermissionCodes.UsersWrite) || !user.organizationId) return null;

  const requests = await apiGet<AccessRequest[]>('/api/access-requests?scope=all');
  if (!requests.ok) return null;
  const decided = requests.data.filter((request) => request.status !== 'Pending').slice(0, 10);
  if (decided.length === 0) return null;
  const now = requestTime();

  return (
    <Panel title="Decided recently" description="The last ten decisions in your organization.">
      <ul className="grid gap-3">
        {decided.map((request) => (
          <RequestCard key={request.id} request={request} now={now} showRequester />
        ))}
      </ul>
    </Panel>
  );
}
