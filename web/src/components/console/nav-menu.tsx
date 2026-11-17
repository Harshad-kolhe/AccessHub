'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2Icon,
  Grid3x3Icon,
  InboxIcon,
  LayoutDashboardIcon,
  ReceiptTextIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

// Icons are components, which cannot cross from server to client props, so the server sends names.
const ICONS = {
  dashboard: LayoutDashboardIcon,
  users: UsersIcon,
  roles: ShieldCheckIcon,
  matrix: Grid3x3Icon,
  requests: InboxIcon,
  checker: ScanSearchIcon,
  invoices: ReceiptTextIcon,
  audit: ScrollTextIcon,
  organizations: Building2Icon,
} as const;

export type NavIcon = keyof typeof ICONS;

export interface NavGroup {
  label?: string;
  items: { href: string; label: string; icon: NavIcon; badge?: number }[];
}

/** Sidebar navigation. The server has already removed the items the user lacks permission for. */
export function NavMenu({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label ?? 'main'}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.label}
                      className="data-[active=true]:shadow-[inset_3px_0_0_var(--brand)]"
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge ? (
                      <SidebarMenuBadge className="rounded-full bg-brand px-1.5 text-brand-foreground tabular" aria-label={`${item.badge} waiting`}>
                        {item.badge}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
