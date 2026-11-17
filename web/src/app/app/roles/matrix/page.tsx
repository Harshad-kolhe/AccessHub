import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import { AccessDenied, ApiErrorNotice, OrganizationRequired } from '@/components/access';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { PERMISSION_CATALOG, PermissionCodes, blockedPermissions, hasPermission } from '@/lib/permissions';
import type { Role, User } from '@/lib/types';
import { PermissionMatrix } from './permission-matrix';

export const metadata: Metadata = { title: 'Permission matrix' };

export default function PermissionMatrixPage() {
  return (
    <>
      <PageHeader
        title="Permission matrix"
        description="Every role against every permission. With roles.write, tick a box to change a role; it saves at once."
        action={
          <Button asChild variant="outline">
            <Link href="/app/roles">
              <ArrowLeftIcon />
              Roles
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <Matrix />
      </Suspense>
    </>
  );
}

async function Matrix() {
  const user = await getCurrentUser();
  if (!user.organizationId) return <OrganizationRequired what="Roles" />;

  const [roles, me] = await Promise.all([
    apiGet<Role[]>(`/api/roles?organizationId=${user.organizationId}`),
    hasPermission(user, PermissionCodes.UsersRead) ? apiGet<User>(`/api/users/${user.id}`) : null,
  ]);
  if (!roles.ok) {
    return roles.status === 403 ? <AccessDenied what="roles" permission={PermissionCodes.RolesRead} /> : <ApiErrorNotice message={roles.error} />;
  }

  const editable = hasPermission(user, PermissionCodes.RolesWrite);
  return (
    <>
      <PermissionMatrix
        roles={roles.data}
        permissions={PERMISSION_CATALOG.filter((permission) => !permission.platform)}
        editable={editable}
        blocked={blockedPermissions(user)}
        heldRoleIds={me?.ok ? me.data.roles.map((role) => role.roleId) : []}
      />
      <p className="mt-3 text-sm text-muted-foreground">
        {editable
          ? 'Changes reach everyone who holds the role straight away. Permissions you don’t hold yourself are read-only here.'
          : 'Read-only: changing roles needs roles.write.'}
      </p>
    </>
  );
}
