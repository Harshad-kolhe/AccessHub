'use client';

import { useOptimistic, useTransition } from 'react';
import { CheckIcon, MinusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BandMarker, PermissionCode, roleBand } from '@/components/access';
import { Checkbox } from '@/components/ui/checkbox';
import type { PermissionInfo } from '@/lib/permissions';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { updateRole } from '../actions';

type Change = { roleId: string; codes: string[] };

/**
 * Roles across, permissions down. Ticking a box saves at once: the tick shows straight away (optimistic) and
 * rolls back if the API refuses, with an Undo in the confirmation toast.
 */
export function PermissionMatrix({
  roles,
  permissions,
  editable,
  blocked,
  heldRoleIds,
}: {
  roles: Role[];
  permissions: PermissionInfo[];
  editable: boolean;
  /** Permissions the editor doesn't hold, so can't add or remove. */
  blocked: string[];
  /** Roles the current user holds (marked, because changing them changes their own access). */
  heldRoleIds: string[];
}) {
  const [optimisticRoles, applyChange] = useOptimistic(roles, (current: Role[], change: Change) =>
    current.map((role) => (role.id === change.roleId ? { ...role, permissionCodes: change.codes } : role)),
  );
  const [pending, startTransition] = useTransition();

  const save = (role: Role, codes: string[], message: string, undoCodes: string[] | null) =>
    startTransition(async () => {
      applyChange({ roleId: role.id, codes });
      const result = await updateRole(role.id, { name: role.name, description: role.description ?? '', permissionCodes: codes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(message, undoCodes ? { action: { label: 'Undo', onClick: () => save(role, undoCodes, `Undone: ${role.name} is back as it was`, null) } } : undefined);
    });

  const toggle = (role: Role, code: string) => {
    const has = role.permissionCodes.includes(code);
    const codes = has ? role.permissionCodes.filter((c) => c !== code) : [...role.permissionCodes, code];
    save(role, codes, has ? `Removed ${code} from ${role.name}` : `Added ${code} to ${role.name}`, role.permissionCodes);
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card" aria-busy={pending}>
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Which permissions each role grants</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 border-b bg-card px-4 py-3 text-left font-medium text-muted-foreground">
              Permission
            </th>
            {optimisticRoles.map((role) => (
              <th key={role.id} scope="col" className="min-w-28 border-b px-3 py-3 text-center align-bottom font-medium">
                <span className="inline-flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-1.5">
                    <BandMarker band={roleBand(role.name)} />
                    {role.name}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {role.userCount} {role.userCount === 1 ? 'person' : 'people'}
                    {heldRoleIds.includes(role.id) && ', yours'}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((permission, index) => {
            // A rule above each new resource (users, roles, invoices, audit), except the first.
            const firstOfResource = index > 0 && permissions[index - 1].resource !== permission.resource;
            const locked = !editable || blocked.includes(permission.code);
            return (
              <tr key={permission.code} className="group">
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-normal group-hover:bg-muted/50',
                    firstOfResource && 'border-t',
                  )}
                >
                  <span className="block">{permission.label}</span>
                  <PermissionCode code={permission.code} className="mt-1 inline-block" />
                </th>
                {optimisticRoles.map((role) => {
                  const granted = role.permissionCodes.includes(permission.code);
                  return (
                    <td key={role.id} className={cn('px-3 py-2.5 text-center group-hover:bg-muted/50', firstOfResource && 'border-t')}>
                      {locked ? (
                        granted ? (
                          <CheckIcon className="mx-auto size-4 text-granted" aria-label={`${role.name} grants ${permission.code}`} />
                        ) : (
                          <MinusIcon className="mx-auto size-4 text-muted-foreground/50" aria-label={`${role.name} doesn't grant ${permission.code}`} />
                        )
                      ) : (
                        <Checkbox
                          checked={granted}
                          disabled={pending}
                          onCheckedChange={() => toggle(role, permission.code)}
                          aria-label={`${role.name}: ${permission.code}`}
                          className="size-5"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
