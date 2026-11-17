'use client';

import { useState } from 'react';
import { MailPlusIcon } from 'lucide-react';
import { BandMarker, roleBand } from '@/components/access';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { inviteUser } from './actions';

export interface GrantableRole {
  id: string;
  name: string;
  /** Permissions in the role the current user lacks; non-empty means they can't grant it. */
  missing: string[];
}

const empty = { email: '', fullName: '', roleIds: [] as string[] };

export function InviteDialog({ roles, defaultOpen }: { roles: GrantableRole[]; defaultOpen?: boolean }) {
  const [form, setForm] = useState(empty);

  const toggleRole = (id: string) =>
    setForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(id) ? current.roleIds.filter((roleId) => roleId !== id) : [...current.roleIds, id],
    }));

  return (
    <FormDialog
      trigger={
        <Button>
          <MailPlusIcon />
          Invite person
        </Button>
      }
      defaultOpen={defaultOpen}
      title="Invite a person"
      description="They get an email with a link to set their password. The link works once, for three days."
      submitLabel="Send invitation"
      successMessage={() => `Invitation sent to ${form.email}`}
      onSubmit={() => inviteUser(form)}
      onClose={() => setForm(empty)}
    >
      <Field>
        <FieldLabel htmlFor="invite-name">Full name</FieldLabel>
        <Input id="invite-name" autoComplete="off" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="invite-email">Email</FieldLabel>
        <Input id="invite-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <FieldSet>
        <FieldLegend variant="label">Roles</FieldLegend>
        {roles.length === 0 ? (
          <FieldDescription>There are no roles yet. Create one on the Roles page first.</FieldDescription>
        ) : (
          <>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {roles.map((role) => {
                const blocked = role.missing.length > 0;
                return (
                  <Field key={role.id} orientation="horizontal" data-disabled={blocked || undefined}>
                    <Checkbox
                      id={`invite-role-${role.id}`}
                      checked={form.roleIds.includes(role.id)}
                      disabled={blocked}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <FieldLabel htmlFor={`invite-role-${role.id}`} className="font-normal" title={blocked ? `Includes ${role.missing.join(', ')}, which you don't have` : undefined}>
                      <BandMarker band={roleBand(role.name)} />
                      {role.name}
                    </FieldLabel>
                  </Field>
                );
              })}
            </div>
            {roles.some((role) => role.missing.length > 0) && (
              <FieldDescription>Greyed-out roles include permissions you don’t have, so you can’t hand them out.</FieldDescription>
            )}
          </>
        )}
      </FieldSet>
    </FormDialog>
  );
}
