import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CircleCheckIcon, CircleXIcon, ScanSearchIcon } from 'lucide-react';
import { AccessDenied, ApiErrorNotice, BandMarker, OrganizationRequired, PermissionCode, RoleBadge, StatusDot, roleBand } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Panel } from '@/components/panel';
import { PanelSkeleton } from '@/components/skeletons';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PERMISSION_CATALOG, PermissionCodes, hasPermission } from '@/lib/permissions';
import type { AccessCheck, Role, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CheckerForm } from './checker-form';

export const metadata: Metadata = { title: 'Access checker' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** What each permission unlocks in this console: the "view as" preview. */
const CAPABILITIES: { label: string; needs: string[] }[] = [
  { label: 'See people and their roles', needs: [PermissionCodes.UsersRead] },
  { label: 'Invite, rename and deactivate people; grant and remove roles', needs: [PermissionCodes.UsersWrite] },
  { label: 'Approve or decline access requests', needs: [PermissionCodes.UsersWrite] },
  { label: 'See roles and the permission matrix', needs: [PermissionCodes.RolesRead] },
  { label: 'Create, change and delete roles', needs: [PermissionCodes.RolesWrite] },
  { label: 'Use this access checker', needs: [PermissionCodes.UsersRead, PermissionCodes.RolesRead] },
  { label: 'See invoices', needs: [PermissionCodes.InvoicesRead] },
  { label: 'Create invoices', needs: [PermissionCodes.InvoicesWrite] },
  { label: 'Read and export the audit log', needs: [PermissionCodes.AuditRead] },
  { label: 'Manage every organization', needs: [PermissionCodes.OrganizationsManage] },
];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function AccessCheckerPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Access checker"
        description="Can this person do that, right now? See the answer, the roles behind it, and the console as they see it."
      />
      <Suspense fallback={<PanelSkeleton />}>
        <Checker searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Checker({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getCurrentUser();
  if (!viewer.organizationId) return <OrganizationRequired what="People" />;
  if (!hasPermission(viewer, PermissionCodes.UsersRead) || !hasPermission(viewer, PermissionCodes.RolesRead)) {
    return (
      <AccessDenied
        what="the access checker"
        permission={hasPermission(viewer, PermissionCodes.UsersRead) ? PermissionCodes.RolesRead : PermissionCodes.UsersRead}
      />
    );
  }

  const params = await searchParams;
  const [users, roles] = await Promise.all([
    apiGet<User[]>(`/api/users?organizationId=${viewer.organizationId}`),
    apiGet<Role[]>(`/api/roles?organizationId=${viewer.organizationId}`),
  ]);
  if (!users.ok) return <ApiErrorNotice message={users.error} />;

  const userId = users.data.some((u) => u.id === one(params.user)) ? one(params.user) : undefined;
  const permission = PERMISSION_CATALOG.some((p) => p.code === one(params.permission)) ? one(params.permission) : undefined;

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card px-5 py-4">
        <CheckerForm
          people={users.data.map((u) => ({ id: u.id, name: u.fullName, email: u.email }))}
          permissions={PERMISSION_CATALOG.map(({ code, label }) => ({ code, label }))}
          user={userId}
          permission={permission}
        />
      </section>
      {userId ? (
        <Result person={users.data.find((u) => u.id === userId)!} permission={permission} roles={roles.ok ? roles.data : []} />
      ) : (
        <EmptyState icon={ScanSearchIcon} title="Pick a person" description="Then a permission, to see whether they have it and which role gives it to them." />
      )}
    </div>
  );
}

async function Result({ person, permission, roles }: { person: User; permission?: string; roles: Role[] }) {
  // Without a permission picked, the check still returns everything the person holds.
  const check = await apiGet<AccessCheck>(`/api/access/check?userId=${person.id}&permission=${encodeURIComponent(permission ?? PermissionCodes.UsersRead)}`);
  if (!check.ok) return <ApiErrorNotice message={check.error} />;

  const effective = new Set(check.data.effectivePermissions);
  const holds = (code: string) => person.isSuperAdmin || effective.has(code);
  const wouldGrant = permission && !check.data.allowed ? roles.filter((role) => role.permissionCodes.includes(permission)) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-6">
        {permission && (
          <section
            className={cn(
              'rounded-xl border px-5 py-5',
              check.data.allowed ? 'border-granted/40 bg-granted-soft' : 'border-denied/40 bg-denied-soft',
            )}
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {check.data.allowed ? (
                <CircleCheckIcon className="mt-0.5 size-6 shrink-0 text-granted" aria-hidden="true" />
              ) : (
                <CircleXIcon className="mt-0.5 size-6 shrink-0 text-denied" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="font-heading text-2xl leading-tight font-semibold">
                  {check.data.allowed ? 'Allowed' : 'Not allowed'}
                </p>
                <p className="mt-1 text-sm">
                  {person.fullName} {check.data.allowed ? 'has' : 'doesn’t have'} <PermissionCode code={permission} />
                  {check.data.viaSuperAdmin && ' as a super admin, who holds every permission'}.
                </p>
                {check.data.grantedBy.length > 0 && (
                  <ul className="mt-3 grid gap-1.5 text-sm">
                    {check.data.grantedBy.map((grant) => (
                      <li key={grant.roleId} className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Granted by</span>
                        <RoleBadge name={grant.roleName} expiresAtUtc={grant.expiresAtUtc} />
                        <span className="text-muted-foreground">{grant.expiresAtUtc ? `until ${formatDate(grant.expiresAtUtc)}` : 'permanently'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!check.data.allowed && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {wouldGrant.length > 0 ? (
                      <>
                        Roles that would give it:{' '}
                        {wouldGrant.map((role, index) => (
                          <span key={role.id} className="inline-flex items-center gap-1 text-foreground">
                            {index > 0 && <span className="text-muted-foreground">, </span>}
                            <BandMarker band={roleBand(role.name)} />
                            {role.name}
                          </span>
                        ))}
                        .
                      </>
                    ) : (
                      'No role in this organization grants it yet.'
                    )}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <Panel
          title={`The console as ${person.fullName} sees it`}
          description={person.isActive ? 'What their permissions unlock right now.' : 'Deactivated: they can’t sign in, whatever their roles allow.'}
          bodyClassName="px-0 py-1"
        >
          <ul className="divide-y">
            {CAPABILITIES.map((capability) => {
              const can = capability.needs.every(holds);
              return (
                <li key={capability.label} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <StatusDot on={can} />
                  <span className={can ? '' : 'text-muted-foreground'}>{capability.label}</span>
                  <span className="ml-auto flex gap-1">
                    {capability.needs.map((code) => (
                      <PermissionCode key={code} code={code} className={cn(!holds(code) && 'opacity-55', code === permission && 'ring-1 ring-brand')} />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel className="self-start" title="Roles they hold" description={`${check.data.effectivePermissions.length} permissions in total.`}>
        {person.isSuperAdmin ? (
          <p className="text-sm text-muted-foreground">Super admins hold every permission and need no roles.</p>
        ) : person.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles, so no permissions.</p>
        ) : (
          <ul className="grid gap-3">
            {person.roles.map((assignment) => {
              const role = roles.find((r) => r.id === assignment.roleId);
              return (
                <li key={assignment.roleId} className="rounded-lg border px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <RoleBadge name={assignment.roleName} expiresAtUtc={assignment.expiresAtUtc} />
                    <span className="text-xs text-muted-foreground">
                      {assignment.expiresAtUtc ? `Temporary, ends ${formatDate(assignment.expiresAtUtc)}` : 'Permanent'}
                    </span>
                  </div>
                  {role && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {role.permissionCodes.map((code) => (
                        <PermissionCode key={code} code={code} className={cn(code === permission && 'ring-1 ring-brand')} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
