import { formatDate } from '@/lib/format';
import type { AuditEvent } from '@/lib/types';

type Payload = Record<string, unknown>;

export interface FieldChange {
  field: string;
  before: string;
  after: string;
  /** For lists (permission codes): what was added and removed. */
  added?: string[];
  removed?: string[];
}

export interface AuditDescription {
  /** Starts lowercase, to follow the actor: "Acme Admin gave Elena Novak the Security Auditor role". */
  phrase: string;
  /** What changed, for events that store a Before and After snapshot. */
  changes: FieldChange[];
  /** The remaining stored details, as label/value pairs. */
  details: { label: string; value: string }[];
}

function parse(json: string | null): Payload {
  if (!json) return {};
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Payload) : {};
  } catch {
    return {};
  }
}

const str = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : null);

function until(value: unknown): string {
  const date = str(value);
  return date ? ` until ${formatDate(date)}` : '';
}

const FIELD_LABELS: Record<string, string> = {
  FullName: 'Name',
  IsActive: 'Active',
  PermissionCodes: 'Permissions',
  ExpiresAtUtc: 'Ends',
  CustomerName: 'Customer',
  Slug: 'Slug',
  Accent: 'Accent',
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'none';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
  return String(value);
}

/** Field-by-field differences between the Before and After snapshots a change stored. */
function diff(before: unknown, after: unknown): FieldChange[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  const b = before as Payload;
  const a = after as Payload;
  const changes: FieldChange[] = [];
  for (const field of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (JSON.stringify(b[field]) === JSON.stringify(a[field])) continue;
    const change: FieldChange = { field: FIELD_LABELS[field] ?? field, before: show(b[field]), after: show(a[field]) };
    if (Array.isArray(b[field]) && Array.isArray(a[field])) {
      const was = new Set((b[field] as unknown[]).map(String));
      const now = new Set((a[field] as unknown[]).map(String));
      change.added = [...now].filter((item) => !was.has(item));
      change.removed = [...was].filter((item) => !now.has(item));
    }
    changes.push(change);
  }
  return changes;
}

/** Turns a stored audit event into a sentence a person can read. */
export function describeAuditEvent(event: AuditEvent): AuditDescription {
  const p = parse(event.payloadJson);
  const after = (p.After as Payload | undefined) ?? {};
  const before = (p.Before as Payload | undefined) ?? {};
  const name = str(p.Name) ?? str(p.FullName) ?? str(after.Name) ?? str(after.FullName) ?? str(p.Email) ?? str(p.Number);
  const user = str(p.User) ?? str(p.Requester) ?? 'someone';
  const role = str(p.Role) ?? 'a';
  const key = `${event.action}:${event.entityType}`;

  const phrases: Record<string, () => string> = {
    'Created:User': () => `added ${name ?? 'a person'}`,
    'Invited:User': () => `invited ${name ?? 'a person'}`,
    'Updated:User': () =>
      before.IsActive === true && after.IsActive === false
        ? `deactivated ${name ?? 'a person'}`
        : before.IsActive === false && after.IsActive === true
          ? `reactivated ${name ?? 'a person'}`
          : `updated ${name ?? 'a person'}`,
    'ResentInvitation:User': () => `resent the invitation to ${name ?? 'a person'}`,
    'AcceptedInvitation:User': () => 'accepted the invitation and set a password',
    'PasswordReset:User': () => 'reset their password',
    'EnabledTwoFactor:User': () => 'turned on two-factor sign-in',
    'DisabledTwoFactor:User': () => 'turned off two-factor sign-in',
    'SignedOutEverywhere:User': () => 'signed out of every device',
    'Created:Role': () => `created the ${name ?? ''} role`,
    'Updated:Role': () => `changed the ${name ?? ''} role`,
    'Deleted:Role': () => `deleted the ${name ?? ''} role`,
    'Granted:RoleAssignment': () => `gave ${user} the ${role} role${until(p.ExpiresAtUtc)}`,
    'Updated:RoleAssignment': () => `changed when ${user}'s ${role} role ends${until(p.ExpiresAtUtc) || ' (now permanent)'}`,
    'Revoked:RoleAssignment': () => `removed the ${role} role from ${user}`,
    'Expired:RoleAssignment': () => `ended ${user}'s temporary ${role} role`,
    'Requested:AccessRequest': () => `asked for the ${role} role`,
    'Approved:AccessRequest': () => `approved ${user}'s request for ${role}${until(p.ExpiresAtUtc)}`,
    'Rejected:AccessRequest': () => `declined ${user}'s request for ${role}`,
    'Cancelled:AccessRequest': () => `withdrew a request for ${role}`,
    'Created:Organization': () => `created the ${name ?? ''} organization`,
    'Updated:Organization': () => `changed the ${name ?? ''} organization`,
    'Created:Invoice': () => `created invoice ${name ?? ''}`,
  };

  const phrase = (phrases[key]?.() ?? `${event.action.toLowerCase()} ${event.entityType.toLowerCase()} ${name ?? ''}`).replace(/\s+/g, ' ').trim();

  const shown = new Set(['Before', 'After', 'Name', 'User', 'Requester', 'Role', 'FullName']);
  const details = Object.entries(p)
    .filter(([field, value]) => !shown.has(field) && value !== null && value !== undefined && value !== '')
    .map(([field, value]) => ({ label: FIELD_LABELS[field] ?? field, value: show(value) }));

  return { phrase, changes: diff(p.Before, p.After), details };
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
