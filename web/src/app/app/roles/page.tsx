import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Grid3x3Icon, ShieldCheckIcon } from 'lucide-react';
import { AccessDenied, ApiErrorNotice, BandMarker, OrganizationRequired, PermissionCode, roleBand } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { PermissionCodes, blockedPermissions, hasPermission, sortPermissionCodes } from '@/lib/permissions';
import type { Role } from '@/lib/types';
import { CreateRoleDialog, RoleActions } from './role-dialogs';

export const metadata: Metadata = { title: 'Roles' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function RolesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Roles"
        description="Each role is a set of permissions. Give people roles instead of permissions one by one."
        action={
          <>
            <Button asChild variant="outline">
              <Link href="/app/roles/matrix">
                <Grid3x3Icon />
                Permission matrix
              </Link>
            </Button>
            <Suspense fallback={null}>
              <AddRoleButton searchParams={searchParams} />
            </Suspense>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <RoleList />
      </Suspense>
    </>
  );
}

async function AddRoleButton({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user.organizationId || !hasPermission(user, PermissionCodes.RolesWrite)) return null;
  const params = await searchParams;
  return <CreateRoleDialog blocked={blockedPermissions(user)} defaultOpen={params.new === '1'} />;
}

async function RoleList() {
  const user = await getCurrentUser();
  if (!user.organizationId) return <OrganizationRequired what="Roles" />;

  const roles = await apiGet<Role[]>(`/api/roles?organizationId=${user.organizationId}`);
  if (!roles.ok) {
    return roles.status === 403 ? <AccessDenied what="roles" permission={PermissionCodes.RolesRead} /> : <ApiErrorNotice message={roles.error} />;
  }
  if (roles.data.length === 0) {
    return <EmptyState icon={ShieldCheckIcon} title="No roles yet" description="Create a role to start granting permissions." />;
  }

  const canWrite = hasPermission(user, PermissionCodes.RolesWrite);
  const blocked = blockedPermissions(user);
  return (
    <ul className="grid gap-3">
      {roles.data.map((role) => (
        <li key={role.id} className="rounded-xl border bg-card px-5 py-4">
          <div className="flex items-start gap-3">
            <BandMarker band={roleBand(role.name)} className="mt-1.5 h-4" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-heading text-lg leading-tight font-semibold">{role.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {role.userCount === 0 ? 'Nobody holds it' : `${role.userCount} ${role.userCount === 1 ? 'person' : 'people'}`}
                  {', '}
                  {role.permissionCodes.length} of 7 permissions
                </p>
              </div>
              {role.description && <p className="mt-0.5 text-sm text-muted-foreground">{role.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {role.permissionCodes.length > 0 ? (
                  sortPermissionCodes(role.permissionCodes).map((code) => <PermissionCode key={code} code={code} />)
                ) : (
                  <span className="text-sm text-muted-foreground">No permissions</span>
                )}
              </div>
            </div>
            {canWrite && (
              <div className="-mt-1 -mr-2">
                <RoleActions role={role} blocked={blocked} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
