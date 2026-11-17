'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Building2Icon,
  FileDownIcon,
  Grid3x3Icon,
  InboxIcon,
  LayoutDashboardIcon,
  MailPlusIcon,
  MonitorIcon,
  MoonIcon,
  ReceiptTextIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldPlusIcon,
  SunIcon,
  UserCogIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

// Icons are components, which can't cross from server to client props, so the server sends names.
export const COMMAND_ICONS = {
  dashboard: LayoutDashboardIcon,
  users: UsersIcon,
  roles: ShieldCheckIcon,
  matrix: Grid3x3Icon,
  requests: InboxIcon,
  checker: ScanSearchIcon,
  invoices: ReceiptTextIcon,
  audit: ScrollTextIcon,
  organizations: Building2Icon,
  account: UserCogIcon,
  invite: MailPlusIcon,
  newRole: ShieldPlusIcon,
  export: FileDownIcon,
} satisfies Record<string, LucideIcon>;

export type CommandIcon = keyof typeof COMMAND_ICONS;

export interface CommandLink {
  href: string;
  label: string;
  icon: CommandIcon;
  /** Extra words that should find this item. */
  keywords?: string[];
  /** A file download rather than a page. */
  download?: boolean;
}

export interface CommandPerson {
  id: string;
  name: string;
  email: string;
}

/**
 * Ctrl+K / Cmd+K: jump to any page, start a common action, or open someone's access check. The server builds the
 * lists, so they only contain what this user is allowed to use.
 */
export function CommandMenu({ pages, actions, people }: { pages: CommandLink[]; actions: CommandLink[]; people: CommandPerson[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const run = (task: () => void) => {
    setOpen(false);
    task();
  };
  const go = (link: CommandLink) =>
    run(() => {
      if (link.download) window.location.assign(link.href);
      else router.push(link.href);
    });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden w-60 justify-start gap-2 font-normal text-muted-foreground lg:inline-flex"
      >
        <SearchIcon />
        Search pages and people
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[0.7rem]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="lg:hidden" aria-label="Search pages and people">
        <SearchIcon />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search AccessHub" description="Jump to a page, an action or a person.">
        <Command>
          <CommandInput placeholder="Type a page, an action or a name…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((link) => {
              const Icon = COMMAND_ICONS[link.icon];
              return (
                <CommandItem key={link.href} value={link.label} keywords={link.keywords} onSelect={() => go(link)}>
                  <Icon />
                  {link.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {actions.length > 0 && (
            <CommandGroup heading="Actions">
              {actions.map((link) => {
                const Icon = COMMAND_ICONS[link.icon];
                return (
                  <CommandItem key={link.href} value={link.label} keywords={link.keywords} onSelect={() => go(link)}>
                    <Icon />
                    {link.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {people.length > 0 && (
            <CommandGroup heading="Check someone’s access">
              {people.map((person) => (
                <CommandItem
                  key={person.id}
                  value={`${person.name} ${person.email}`}
                  onSelect={() => run(() => router.push(`/app/access-checker?user=${person.id}`))}
                >
                  <UserIcon />
                  {person.name}
                  <span className="ml-auto truncate text-xs text-muted-foreground">{person.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Appearance">
            <CommandItem value="Light mode" onSelect={() => run(() => setTheme('light'))}>
              <SunIcon />
              Light mode
            </CommandItem>
            <CommandItem value="Dark mode" onSelect={() => run(() => setTheme('dark'))}>
              <MoonIcon />
              Dark mode
            </CommandItem>
            <CommandItem value="Match the system" onSelect={() => run(() => setTheme('system'))}>
              <MonitorIcon />
              Match the system
              <CommandShortcut>theme</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
