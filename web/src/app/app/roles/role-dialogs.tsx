'use client';

import { useState } from 'react';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormDialog } from '@/components/form-dialog';
import { PermissionPicker } from '@/components/permission-picker';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Role } from '@/lib/types';
import { createRole, deleteRole, updateRole, type RoleInput } from './actions';

const empty: RoleInput = { name: '', description: '', permissionCodes: [] };

function RoleFields({ form, setForm, blocked }: { form: RoleInput; setForm: (form: RoleInput) => void; blocked: string[] }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="role-name">Name</FieldLabel>
        <Input id="role-name" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="role-description">Description</FieldLabel>
        <Input
          id="role-description"
          autoComplete="off"
          placeholder="Optional"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
      <PermissionPicker value={form.permissionCodes} onChange={(permissionCodes) => setForm({ ...form, permissionCodes })} blocked={blocked} />
    </>
  );
}

export function CreateRoleDialog({ blocked, defaultOpen }: { blocked: string[]; defaultOpen?: boolean }) {
  const [form, setForm] = useState(empty);
  return (
    <FormDialog
      triggerLabel="New role"
      defaultOpen={defaultOpen}
      title="New role"
      description="Pick the permissions this role grants. You can give it to people afterwards."
      submitLabel="Create role"
      successMessage={() => `Role ${form.name} created`}
      onSubmit={() => createRole(form)}
      onClose={() => setForm(empty)}
    >
      <RoleFields form={form} setForm={setForm} blocked={blocked} />
    </FormDialog>
  );
}

/** Edit and delete, for people with roles.write. */
export function RoleActions({ role, blocked }: { role: Role; blocked: string[] }) {
  const [open, setOpen] = useState<'edit' | 'delete' | null>(null);
  const [form, setForm] = useState<RoleInput>({ name: role.name, description: role.description ?? '', permissionCodes: role.permissionCodes });

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${role.name}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setForm({ name: role.name, description: role.description ?? '', permissionCodes: role.permissionCodes });
              setOpen('edit');
            }}
          >
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen('delete')}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FormDialog
        open={open === 'edit'}
        onOpenChange={(next) => setOpen(next ? 'edit' : null)}
        title={`Edit ${role.name}`}
        description={role.userCount > 0 ? `${role.userCount} ${role.userCount === 1 ? 'person holds' : 'people hold'} this role; changes reach them at once.` : undefined}
        submitLabel="Save role"
        successMessage={() => `Role ${form.name} saved`}
        onSubmit={() => updateRole(role.id, form)}
      >
        <RoleFields form={form} setForm={setForm} blocked={blocked} />
      </FormDialog>

      <ConfirmDialog
        open={open === 'delete'}
        onOpenChange={(next) => setOpen(next ? 'delete' : null)}
        title={`Delete ${role.name}?`}
        description={
          <>
            {role.userCount > 0 ? (
              <p>
                {role.userCount} {role.userCount === 1 ? 'person loses' : 'people lose'} the permissions it grants, straight away.
              </p>
            ) : (
              <p>Nobody holds this role.</p>
            )}
            <p>The audit log keeps a record of the role and what it granted.</p>
          </>
        }
        confirmLabel="Delete role"
        onConfirm={async () => {
          const result = await deleteRole(role.id);
          if (result.ok) toast.success(`Role ${role.name} deleted`);
          return result;
        }}
      />
    </>
  );
}
