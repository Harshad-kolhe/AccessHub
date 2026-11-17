'use client';

import { useState, useTransition } from 'react';
import { MailIcon, MoreHorizontalIcon, PencilIcon, ShieldCheckIcon, UserCheckIcon, UserXIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BandMarker, RoleBadge, roleBand } from '@/components/access';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ExpiryPicker } from '@/components/expiry-picker';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/format';
import type { UserRole } from '@/lib/types';
import { grantRole, resendInvite, revokeRole, updateUser } from './actions';
import type { GrantableRole } from './invite-dialog';

export interface PersonSummary {
  id: string;
  fullName: string;
  isActive: boolean;
  isInvited: boolean;
  roles: UserRole[];
}

type Open = 'roles' | 'rename' | 'deactivate' | null;

/** The "…" menu on each person: roles, name, invitation, and deactivation. */
export function PersonActions({ person, roles }: { person: PersonSummary; roles: GrantableRole[] }) {
  const [open, setOpen] = useState<Open>(null);
  const [name, setName] = useState(person.fullName);

  const reactivate = async () => {
    const result = await updateUser(person.id, person.fullName, true);
    if (result.ok) toast.success(`${person.fullName} can sign in again`);
    else toast.error(result.error);
  };

  const resend = async () => {
    const result = await resendInvite(person.id);
    if (result.ok) toast.success(`Invitation sent to ${person.fullName} again`);
    else toast.error(result.error);
  };

  return (
    <>
      {/* Not modal: a modal menu that opens a dialog can leave the page unclickable (a Radix focus quirk). */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${person.fullName}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setOpen('roles')}>
            <ShieldCheckIcon />
            Manage roles
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setName(person.fullName);
              setOpen('rename');
            }}
          >
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          {person.isInvited && (
            <DropdownMenuItem onSelect={resend}>
              <MailIcon />
              Resend invitation
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {person.isActive ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setOpen('deactivate')}>
              <UserXIcon />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={reactivate}>
              <UserCheckIcon />
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RolesDialog person={person} roles={roles} open={open === 'roles'} onOpenChange={(next) => setOpen(next ? 'roles' : null)} />

      <FormDialog
        open={open === 'rename'}
        onOpenChange={(next) => setOpen(next ? 'rename' : null)}
        title={`Rename ${person.fullName}`}
        submitLabel="Save name"
        successMessage={() => `Renamed to ${name}`}
        onSubmit={() => updateUser(person.id, name, person.isActive)}
      >
        <Field>
          <FieldLabel htmlFor={`rename-${person.id}`}>Full name</FieldLabel>
          <Input id={`rename-${person.id}`} value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={open === 'deactivate'}
        onOpenChange={(next) => setOpen(next ? 'deactivate' : null)}
        title={`Deactivate ${person.fullName}?`}
        description={
          <>
            <p>They are signed out of every device at once and can’t sign in until someone reactivates them.</p>
            <p>Their roles stay as they are, so reactivating restores the same access.</p>
          </>
        }
        confirmLabel="Deactivate"
        onConfirm={async () => {
          const result = await updateUser(person.id, person.fullName, false);
          if (result.ok) {
            toast.success(`${person.fullName} was deactivated`, {
              action: { label: 'Undo', onClick: () => void updateUser(person.id, person.fullName, true) },
            });
          }
          return result;
        }}
      />
    </>
  );
}

function RolesDialog({
  person,
  roles,
  open,
  onOpenChange,
}: {
  person: PersonSummary;
  roles: GrantableRole[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [roleId, setRoleId] = useState('');
  const [expiresAtUtc, setExpiresAtUtc] = useState<string | null | undefined>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [busyRole, setBusyRole] = useState<string | null>(null);

  const held = new Set(person.roles.map((role) => role.roleId));
  const available = roles.filter((role) => !held.has(role.id));
  const missingFor = (id: string) => roles.find((role) => role.id === id)?.missing ?? [];

  const reset = () => {
    setRoleId('');
    setExpiresAtUtc(null);
    setPickerKey((key) => key + 1);
  };

  const grant = () =>
    startTransition(async () => {
      const role = roles.find((r) => r.id === roleId);
      const result = await grantRole(person.id, roleId, expiresAtUtc ?? null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${person.fullName} now has ${role?.name ?? 'the role'}${expiresAtUtc ? ` until ${formatDate(expiresAtUtc)}` : ''}`);
      reset();
    });

  const remove = (assignment: UserRole) =>
    startTransition(async () => {
      setBusyRole(assignment.roleId);
      const result = await revokeRole(person.id, assignment.roleId);
      setBusyRole(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${assignment.roleName} from ${person.fullName}`, {
        action: { label: 'Undo', onClick: () => void grantRole(person.id, assignment.roleId, assignment.expiresAtUtc) },
      });
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        // Clicking a toast (its Undo button) must not count as clicking outside, which would close the dialog.
        onInteractOutside={(event) => {
          if ((event.target as Element | null)?.closest('[data-sonner-toaster]')) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Roles of {person.fullName}</DialogTitle>
          <DialogDescription>Changes apply at once: their current sessions pick up the new permissions.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <p className="text-sm font-medium">Current roles</p>
          {person.roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles yet, so no permissions.</p>
          ) : (
            <ul className="grid gap-1.5">
              {person.roles.map((assignment) => {
                const blocked = missingFor(assignment.roleId).length > 0;
                return (
                  <li key={assignment.roleId} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                      <RoleBadge name={assignment.roleName} expiresAtUtc={assignment.expiresAtUtc} />
                      <span className="text-xs text-muted-foreground">
                        Since {formatDate(assignment.assignedAtUtc)}
                        {assignment.expiresAtUtc ? `, ends ${formatDate(assignment.expiresAtUtc)}` : ', permanent'}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || blocked}
                      title={blocked ? 'This role includes permissions you don’t have' : undefined}
                      onClick={() => remove(assignment)}
                      aria-label={`Remove ${assignment.roleName}`}
                    >
                      {busyRole === assignment.roleId ? <Spinner /> : <XIcon />}
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Separator />

        <div className="grid gap-4">
          <p className="text-sm font-medium">Grant a role</p>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">They already have every role.</p>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor={`grant-${person.id}`} className="sr-only">
                  Role
                </FieldLabel>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger id={`grant-${person.id}`} className="w-full">
                    <SelectValue placeholder="Pick a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((role) => (
                      <SelectItem key={role.id} value={role.id} disabled={role.missing.length > 0}>
                        <BandMarker band={roleBand(role.name)} />
                        {role.name}
                        {role.missing.length > 0 && <span className="text-xs text-muted-foreground">needs {role.missing.join(', ')}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <ExpiryPicker key={pickerKey} idPrefix={`grant-${person.id}`} onChange={setExpiresAtUtc} />
              <Button onClick={grant} disabled={pending || !roleId || expiresAtUtc === undefined} className="justify-self-start">
                {pending && !busyRole && <Spinner />}
                Grant role
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
