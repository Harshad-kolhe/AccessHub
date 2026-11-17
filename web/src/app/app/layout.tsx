import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { Building2Icon } from 'lucide-react';
import { AppearanceMenu } from '@/components/appearance-menu';
import { AccountMenu } from '@/components/console/account-menu';
import { CommandMenu, type CommandLink, type CommandPerson } from '@/components/console/command-menu';
import { NavMenu, type NavGroup, type NavIcon } from '@/components/console/nav-menu';
import { OrganizationAccent } from '@/components/console/organization-accent';
import { RealtimeBridge } from '@/components/console/realtime-bridge';
import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { PermissionCodes, hasPermission } from '@/lib/permissions';
import type { AccessRequest, CurrentUser, User } from '@/lib/types';
import { logout } from './actions';

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Every listed permission is needed to see the item. */
  permissions?: string[];
  keywords?: string[];
}

const NAV: { label?: string; items: NavItem[] }[] = [
  { items: [{ href: '/app', label: 'Dashboard', icon: 'dashboard', keywords: ['home', 'charts', 'overview'] }] },
  {
    label: 'Access',
    items: [
      { href: '/app/users', label: 'People', icon: 'users', permissions: [PermissionCodes.UsersRead], keywords: ['users', 'invite'] },
      { href: '/app/roles', label: 'Roles', icon: 'roles', permissions: [PermissionCodes.RolesRead] },
      { href: '/app/roles/matrix', label: 'Permission matrix', icon: 'matrix', permissions: [PermissionCodes.RolesRead], keywords: ['grid'] },
      { href: '/app/access-requests', label: 'Access requests', icon: 'requests', keywords: ['approve', 'request'] },
      {
        href: '/app/access-checker',
        label: 'Access checker',
        icon: 'checker',
        permissions: [PermissionCodes.UsersRead, PermissionCodes.RolesRead],
        keywords: ['can', 'view as', 'effective permissions'],
      },
    ],
  },
  {
    label: 'Business',
    items: [{ href: '/app/invoices', label: 'Invoices', icon: 'invoices', permissions: [PermissionCodes.InvoicesRead] }],
  },
  {
    label: 'Compliance',
    items: [{ href: '/app/audit', label: 'Audit log', icon: 'audit', permissions: [PermissionCodes.AuditRead], keywords: ['history', 'changes'] }],
  },
  {
    label: 'Platform',
    items: [{ href: '/app/organizations', label: 'Organizations', icon: 'organizations', permissions: [PermissionCodes.OrganizationsManage], keywords: ['tenants'] }],
  },
];

const allowed = (user: CurrentUser, item: NavItem) => (item.permissions ?? []).every((code) => hasPermission(user, code));

/** The frame is prerendered; everything that depends on who is signed in streams in behind Suspense. */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 pt-4 pb-2">
          <Link href="/app" className="flex h-9 items-center text-white" aria-label="AccessHub dashboard">
            <Logo className="[&>span:last-child]:group-data-[collapsible=icon]:hidden" />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <Suspense fallback={<NavSkeleton />}>
            <Navigation />
          </Suspense>
        </SidebarContent>
        <SidebarFooter>
          <Suspense fallback={<SkeletonRow width="w-32" tall />}>
            <Account />
          </Suspense>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5!" />
          <Suspense fallback={null}>
            <TenantIndicator />
          </Suspense>
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={null}>
              <HeaderTools />
            </Suspense>
            <AppearanceMenu />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Fixed widths: shadcn's SidebarMenuSkeleton picks a random width, which cannot be part of a prerendered shell.
function SkeletonRow({ width, tall = false }: { width: string; tall?: boolean }) {
  return (
    <div className={tall ? 'flex h-12 items-center gap-2 px-2' : 'flex h-8 items-center gap-2 px-2'}>
      <Skeleton className={tall ? 'size-8 rounded-lg bg-white/10' : 'size-4 rounded-md bg-white/10'} />
      <Skeleton className={`h-4 bg-white/10 ${width}`} />
    </div>
  );
}

function NavSkeleton() {
  return (
    <div className="grid gap-1 p-2" aria-busy="true" aria-label="Loading navigation">
      {['w-24', 'w-20', 'w-16', 'w-28', 'w-24', 'w-24', 'w-20'].map((width, row) => (
        <SkeletonRow key={row} width={width} />
      ))}
    </div>
  );
}

async function Navigation() {
  const user = await getCurrentUser();
  // Approvers see how many requests are waiting for them.
  const pending =
    hasPermission(user, PermissionCodes.UsersWrite) && user.organizationId
      ? await apiGet<AccessRequest[]>('/api/access-requests?scope=pending')
      : null;
  const waiting = pending?.ok ? pending.data.filter((request) => request.requesterUserId !== user.id).length : 0;

  const groups: NavGroup[] = NAV.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => allowed(user, item))
      .map(({ href, label, icon }) => ({ href, label, icon, badge: href === '/app/access-requests' ? waiting : undefined })),
  })).filter((group) => group.items.length > 0);

  return <NavMenu groups={groups} />;
}

async function Account() {
  const user = await getCurrentUser();
  return (
    <AccountMenu
      fullName={user.fullName}
      email={user.email}
      organization={user.organizationName ?? 'Every organization'}
      permissionCount={user.permissions.length}
      signOut={logout}
    />
  );
}

/** Always shows which tenant the user is acting in. */
async function TenantIndicator() {
  const user = await getCurrentUser();
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <Building2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-medium">{user.organizationName ?? 'All organizations'}</span>
      {user.isSuperAdmin && <Badge variant="outline">Super admin</Badge>}
    </span>
  );
}

/** Search (Ctrl+K), the live-updates indicator and the organization's accent: all depend on the user. */
async function HeaderTools() {
  const user = await getCurrentUser();
  const pages: CommandLink[] = [
    ...NAV.flatMap((group) => group.items)
      .filter((item) => allowed(user, item))
      .map(({ href, label, icon, keywords }) => ({ href, label, icon, keywords })),
    { href: '/app/account', label: 'Account and security', icon: 'account', keywords: ['two-factor', '2fa', 'sessions', 'password'] },
  ];

  const canWriteUsers = hasPermission(user, PermissionCodes.UsersWrite) && user.organizationId !== null;
  const actions: CommandLink[] = [
    ...(canWriteUsers ? [{ href: '/app/users?new=1', label: 'Invite a person', icon: 'invite' as const, keywords: ['add user'] }] : []),
    ...(hasPermission(user, PermissionCodes.RolesWrite) && user.organizationId
      ? [{ href: '/app/roles?new=1', label: 'Create a role', icon: 'newRole' as const }]
      : []),
    ...(!user.isSuperAdmin ? [{ href: '/app/access-requests?new=1', label: 'Request access', icon: 'requests' as const, keywords: ['ask', 'permission'] }] : []),
    ...(hasPermission(user, PermissionCodes.AuditRead)
      ? [{ href: '/app/audit/export', label: 'Download the audit log (CSV)', icon: 'export' as const, download: true, keywords: ['export', 'csv'] }]
      : []),
  ];

  let people: CommandPerson[] = [];
  if (user.organizationId && hasPermission(user, PermissionCodes.UsersRead) && hasPermission(user, PermissionCodes.RolesRead)) {
    const users = await apiGet<User[]>('/api/users');
    people = users.ok ? users.data.map(({ id, fullName, email }) => ({ id, name: fullName, email })) : [];
  }

  return (
    <>
      <CommandMenu pages={pages} actions={actions} people={people} />
      <RealtimeBridge userId={user.id} />
      <OrganizationAccent accent={user.organizationAccent} />
    </>
  );
}
