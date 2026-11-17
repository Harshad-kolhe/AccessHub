'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckIcon, InboxIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BandMarker, PermissionCode, roleBand } from '@/components/access';
import { ExpiryPicker } from '@/components/expiry-picker';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';
import { sortPermissionCodes, type PermissionInfo } from '@/lib/permissions';
import type { AccessRequest, RoleOption } from '@/lib/types';
import { approveRequest, cancelRequest, rejectRequest, requestAccess } from './actions';

const ANY = 'any';

/** "I need X": pick what you need to do, then the role that grants it, and say why. */
export function RequestAccessDialog({
  roles,
  missingPermissions,
  heldRoleIds,
  defaultOpen,
  defaultPermission,
}: {
  roles: RoleOption[];
  /** Permissions the requester doesn't have yet (organization permissions only). */
  missingPermissions: PermissionInfo[];
  heldRoleIds: string[];
  defaultOpen?: boolean;
  defaultPermission?: string;
}) {
  const initialPermission = missingPermissions.some((p) => p.code === defaultPermission) ? defaultPermission! : ANY;
  const [permission, setPermission] = useState(initialPermission);
  const [roleId, setRoleId] = useState('');
  const [reason, setReason] = useState('');

  const candidates = useMemo(
    () =>
      roles
        .filter((role) => !heldRoleIds.includes(role.id))
        .filter((role) => permission === ANY || role.permissionCodes.includes(permission))
        // Smallest role first: ask for no more than you need.
        .sort((a, b) => a.permissionCodes.length - b.permissionCodes.length || a.name.localeCompare(b.name)),
    [roles, heldRoleIds, permission],
  );
  const chosen = candidates.find((role) => role.id === roleId);

  return (
    <FormDialog
      trigger={
        <Button>
          <InboxIcon />
          Request access
        </Button>
      }
      defaultOpen={defaultOpen}
      title="Request access"
      description="An admin who can grant the role decides. You’ll get a notification either way."
      submitLabel="Send request"
      submitDisabled={!roleId || reason.trim().length < 10}
      successMessage={() => `Asked for ${chosen?.name ?? 'the role'}`}
      onSubmit={() => requestAccess(roleId, permission === ANY ? null : permission, reason)}
      onClose={() => {
        setPermission(initialPermission);
        setRoleId('');
        setReason('');
      }}
    >
      <Field>
        <FieldLabel htmlFor="request-permission">What do you need to do?</FieldLabel>
        <Select
          value={permission}
          onValueChange={(value) => {
            setPermission(value);
            setRoleId('');
          }}
        >
          <SelectTrigger id="request-permission" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Show every role</SelectItem>
            {missingPermissions.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.label}
                <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="request-role">Role</FieldLabel>
        <Select value={roleId} onValueChange={setRoleId} disabled={candidates.length === 0}>
          <SelectTrigger id="request-role" className="w-full">
            <SelectValue placeholder={candidates.length === 0 ? 'No role grants that yet' : 'Pick a role'} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <BandMarker band={roleBand(role.name)} />
                {role.name}
                <span className="text-xs text-muted-foreground">{role.permissionCodes.length} permissions</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chosen && (
          <div className="flex flex-wrap gap-1.5 pt-1" aria-label={`${chosen.name} grants`}>
            {sortPermissionCodes(chosen.permissionCodes).map((code) => (
              <PermissionCode key={code} code={code} />
            ))}
          </div>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor="request-reason">Why do you need it?</FieldLabel>
        <Textarea
          id="request-reason"
          rows={3}
          maxLength={500}
          placeholder="For example: I’m covering month-end invoicing while Priya is away."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <FieldDescription>At least 10 characters. The approver sees this, and the audit log keeps it.</FieldDescription>
      </Field>
    </FormDialog>
  );
}

/** Approve (optionally for a limited time) or decline, with a note for the requester. */
export function DecisionButtons({ request }: { request: AccessRequest }) {
  const [open, setOpen] = useState<'approve' | 'reject' | null>(null);
  const [expiresAtUtc, setExpiresAtUtc] = useState<string | null | undefined>(null);
  const [note, setNote] = useState('');

  const reset = () => {
    setExpiresAtUtc(null);
    setNote('');
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setOpen('approve')}>
        <CheckIcon />
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen('reject')}>
        <XIcon />
        Decline
      </Button>

      <FormDialog
        open={open === 'approve'}
        onOpenChange={(next) => setOpen(next ? 'approve' : null)}
        title={`Give ${request.requesterName} ${request.roleName}?`}
        description="They get the role straight away; their open sessions pick it up within seconds."
        submitLabel="Approve"
        submitDisabled={expiresAtUtc === undefined}
        successMessage={() => `${request.requesterName} now has ${request.roleName}${expiresAtUtc ? ` until ${formatDate(expiresAtUtc)}` : ''}`}
        onSubmit={() => approveRequest(request.id, expiresAtUtc ?? null, note)}
        onClose={reset}
      >
        <ExpiryPicker idPrefix={`approve-${request.id}`} legend="For how long" onChange={setExpiresAtUtc} />
        <Field>
          <FieldLabel htmlFor={`approve-note-${request.id}`}>Note for {request.requesterName}</FieldLabel>
          <Textarea id={`approve-note-${request.id}`} rows={2} maxLength={500} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormDialog>

      <FormDialog
        open={open === 'reject'}
        onOpenChange={(next) => setOpen(next ? 'reject' : null)}
        title={`Decline ${request.requesterName}’s request?`}
        description="They’ll see your note, so say what to do instead if there is a better route."
        submitLabel="Decline request"
        destructive
        successMessage={() => `Declined ${request.requesterName}’s request`}
        onSubmit={() => rejectRequest(request.id, note)}
        onClose={reset}
      >
        <Field>
          <FieldLabel htmlFor={`reject-note-${request.id}`}>Note for {request.requesterName}</FieldLabel>
          <Textarea id={`reject-note-${request.id}`} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormDialog>
    </div>
  );
}

export function WithdrawButton({ request }: { request: AccessRequest }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelRequest(request.id);
          if (result.ok) toast.success(`Withdrew your request for ${request.roleName}`);
          else toast.error(result.error);
        })
      }
    >
      {pending && <Spinner />}
      Withdraw
    </Button>
  );
}
