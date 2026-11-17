import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LockIcon, MailIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { AccessDenied, ActiveStatus, ApiErrorNotice, OrganizationRequired, RoleBadge } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { requestTime } from '@/lib/clock';
import { formatDateTime, formatRelative, formatTime } from '@/lib/format';
import { PermissionCodes, hasPermission } from '@/lib/permissions';
import type { CurrentUser, Role, User } from '@/lib/types';
import { InviteDialog, type GrantableRole } from './invite-dialog';
import { PersonActions } from './person-actions';

export const metadata: Metadata = { title: 'People' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="People"
        description="Everyone in your organization. Their roles decide what they can see and change."
        action={
          <Suspense fallback={null}>
            <InviteButton searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <PeopleList />
      </Suspense>
    </>
  );
}

/** Roles the current user may hand out: only those whose permissions they hold themselves. */
function grantable(user: CurrentUser, roles: Role[]): GrantableRole[] {
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    missing: user.isSuperAdmin ? [] : role.permissionCodes.filter((code) => !hasPermission(user, code)),
  }));
}

async function InviteButton({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user.organizationId || !hasPermission(user, PermissionCodes.UsersWrite)) return null;

  const [roles, params] = await Promise.all([apiGet<Role[]>(`/api/roles?organizationId=${user.organizationId}`), searchParams]);
  return <InviteDialog roles={roles.ok ? grantable(user, roles.data) : []} defaultOpen={params.new === '1'} />;
}

async function PeopleList() {
  const user = await getCurrentUser();
  if (!user.organizationId) return <OrganizationRequired what="People" />;

  const canWrite = hasPermission(user, PermissionCodes.UsersWrite);
  const [users, roles] = await Promise.all([
    apiGet<User[]>(`/api/users?organizationId=${user.organizationId}`),
    canWrite ? apiGet<Role[]>(`/api/roles?organizationId=${user.organizationId}`) : null,
  ]);
  if (!users.ok) {
    return users.status === 403 ? <AccessDenied what="people" permission={PermissionCodes.UsersRead} /> : <ApiErrorNotice message={users.error} />;
  }
  if (users.data.length === 0) {
    return <EmptyState icon={UsersIcon} title="No one here yet" description="Invite the first person to this organization." />;
  }

  const grantableRoles = roles?.ok ? grantable(user, roles.data) : [];
  const now = requestTime();
  const actionsFor = (person: User) =>
    canWrite && person.id !== user.id ? (
      <PersonActions
        person={{ id: person.id, fullName: person.fullName, isActive: person.isActive, isInvited: person.isInvited, roles: person.roles }}
        roles={grantableRoles}
      />
    ) : null;

  return (
    <>
      {/* Phones: one card per person. */}
      <ul className="grid gap-3 lg:hidden">
        {users.data.map((person) => (
          <li key={person.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <PersonIdentity person={person} isYou={person.id === user.id} />
              <div className="ml-auto -mt-1 -mr-2">{actionsFor(person)}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Roles person={person} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <ActiveStatus active={person.isActive} />
              <LastSignIn person={person} now={now} />
            </div>
          </li>
        ))}
      </ul>

      {/* Larger screens: the table. */}
      <div className="hidden rounded-xl border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Person</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="py-3 pl-5">
                  <PersonIdentity person={person} isYou={person.id === user.id} />
                </TableCell>
                <TableCell className="py-3 whitespace-normal">
                  <div className="flex max-w-sm flex-wrap gap-1.5">
                    <Roles person={person} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <LastSignIn person={person} now={now} />
                </TableCell>
                <TableCell>
                  <ActiveStatus active={person.isActive} />
                </TableCell>
                <TableCell className="pr-3 text-right">{actionsFor(person)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PersonIdentity({ person, isYou }: { person: User; isYou: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9">
        <AvatarFallback className="text-xs font-medium">{initialsOf(person.fullName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          <span className="truncate">{person.fullName}</span>
          {isYou && <span className="font-normal text-muted-foreground">(you)</span>}
          {person.isInvited && (
            <Badge variant="outline" className="gap-1 font-normal">
              <MailIcon className="size-3" aria-hidden="true" />
              Invited
            </Badge>
          )}
          {person.lockedUntilUtc && (
            <Badge variant="outline" className="gap-1 border-denied/40 font-normal text-denied" title={`Locked until ${formatDateTime(person.lockedUntilUtc)}`}>
              <LockIcon className="size-3" aria-hidden="true" />
              Locked until {formatTime(person.lockedUntilUtc)}
            </Badge>
          )}
          {person.twoFactorEnabled && (
            <span className="inline-flex items-center text-granted" title="Two-factor sign-in is on">
              <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Two-factor sign-in is on</span>
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{person.email}</p>
      </div>
    </div>
  );
}

function Roles({ person }: { person: User }) {
  return person.roles.length > 0 ? (
    person.roles.map((role) => <RoleBadge key={role.roleId} name={role.roleName} expiresAtUtc={role.expiresAtUtc} />)
  ) : (
    <span className="text-sm text-muted-foreground">No roles</span>
  );
}

function LastSignIn({ person, now }: { person: User; now: number }) {
  if (person.isInvited) return <span>Hasn’t accepted yet</span>;
  if (!person.lastSignInAtUtc) return <span>Never</span>;
  return (
    <time dateTime={person.lastSignInAtUtc} title={formatDateTime(person.lastSignInAtUtc)}>
      {formatRelative(person.lastSignInAtUtc, now)}
    </time>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
