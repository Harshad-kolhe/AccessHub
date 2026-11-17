import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Building2Icon } from 'lucide-react';
import { AccessDenied, ActiveStatus, ApiErrorNotice } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiGet } from '@/lib/api';
import { ACCENTS } from '@/lib/appearance';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { PermissionCodes, hasPermission } from '@/lib/permissions';
import type { Organization } from '@/lib/types';
import { CreateOrganizationDialog, EditOrganizationButton } from './organization-dialogs';

export const metadata: Metadata = { title: 'Organizations' };

export default function OrganizationsPage() {
  return (
    <>
      <PageHeader
        title="Organizations"
        description="Every tenant on the platform. Only super admins hold organizations.manage, so tenants never see each other."
        action={
          <Suspense fallback={null}>
            <AddOrganizationButton />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <OrganizationTable />
      </Suspense>
    </>
  );
}

async function AddOrganizationButton() {
  const user = await getCurrentUser();
  return hasPermission(user, PermissionCodes.OrganizationsManage) ? <CreateOrganizationDialog /> : null;
}

function Accent({ accent }: { accent: string | null }) {
  const preset = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: preset.swatch }} />
      {preset.label}
    </span>
  );
}

async function OrganizationTable() {
  const organizations = await apiGet<Organization[]>('/api/organizations');
  if (!organizations.ok) {
    return organizations.status === 403 ? (
      <AccessDenied what="organizations" permission={PermissionCodes.OrganizationsManage} requestable={false} />
    ) : (
      <ApiErrorNotice message={organizations.error} />
    );
  }
  if (organizations.data.length === 0) {
    return <EmptyState icon={Building2Icon} title="No organizations yet" description="Create the first tenant on the platform." />;
  }

  return (
    <>
      <ul className="grid gap-3 lg:hidden">
        {organizations.data.map((organization) => (
          <li key={organization.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{organization.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{organization.slug}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{organization.userCount} people</span>
                <Accent accent={organization.accent} />
                <ActiveStatus active={organization.isActive} />
              </div>
            </div>
            <EditOrganizationButton organization={organization} />
          </li>
        ))}
      </ul>
      <div className="hidden rounded-xl border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">People</TableHead>
              <TableHead>Accent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.data.map((organization) => (
              <TableRow key={organization.id}>
                <TableCell className="py-3 pl-5 font-medium">{organization.name}</TableCell>
                <TableCell className="font-mono text-[0.8rem] text-muted-foreground">{organization.slug}</TableCell>
                <TableCell className="text-right tabular">{organization.userCount}</TableCell>
                <TableCell>
                  <Accent accent={organization.accent} />
                </TableCell>
                <TableCell>
                  <ActiveStatus active={organization.isActive} />
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular">{formatDate(organization.createdAtUtc)}</TableCell>
                <TableCell className="pr-3 text-right">
                  <EditOrganizationButton organization={organization} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
