'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { ChevronsUpDownIcon, LogOutIcon, UserCogIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { initials } from '@/lib/format';

interface AccountMenuProps {
  fullName: string;
  email: string;
  organization: string;
  permissionCount: number;
  /** The sign-out Server Action, passed down from the layout. */
  signOut: () => Promise<void>;
}

export function AccountMenu({ fullName, email, organization, permissionCount, signOut }: AccountMenuProps) {
  const [pending, startTransition] = useTransition();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-brand font-medium text-brand-foreground">{initials(fullName)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium text-white">{fullName}</span>
                <span className="truncate text-xs">{organization}</span>
              </span>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="block font-medium text-foreground">{fullName}</span>
              <span className="block text-xs text-muted-foreground">{email}</span>
              <span className="mt-1.5 block text-xs text-muted-foreground">
                {permissionCount} permissions in {organization}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/account">
                <UserCogIcon />
                Account and security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => {
                startTransition(async () => {
                  await signOut();
                });
              }}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
