import Link from 'next/link';
import { Building2Icon, CircleAlertIcon, ClockIcon, LockIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Permission codes are literal identifiers the API checks, so they are always set in mono. */
export function PermissionCode({ code, className }: { code: string; className?: string }) {
  return (
    <code className={cn('rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[0.78rem] whitespace-nowrap text-foreground/85', className)}>
      {code}
    </code>
  );
}

const BAND_CLASSES = {
  cobalt: 'bg-band-cobalt',
  teal: 'bg-band-teal',
  violet: 'bg-band-violet',
  amber: 'bg-band-amber',
  rose: 'bg-band-rose',
  slate: 'bg-band-slate',
} as const;

export type Band = keyof typeof BAND_CLASSES;

/** Every role keeps one clearance color, so it is recognizable across tables, forms and badges. */
// The demo roles get fixed, distinct bands; any other role name hashes to one.
const KNOWN_BANDS: Record<string, Band> = {
  OrgAdmin: 'cobalt',
  Viewer: 'slate',
  Billing: 'teal',
  Support: 'violet',
  'Security Auditor': 'amber',
};

export function roleBand(name: string): Band {
  if (Object.hasOwn(KNOWN_BANDS, name)) return KNOWN_BANDS[name];
  const bands: Band[] = ['teal', 'violet', 'amber', 'rose'];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return bands[hash % bands.length];
}

export function BandMarker({ band, className }: { band: Band; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-3 w-1.5 shrink-0 rounded-[2px]', BAND_CLASSES[band], className)} />;
}

/** A role, in its clearance color. Temporary grants show when they end. */
export function RoleBadge({ name, expiresAtUtc }: { name: string; expiresAtUtc?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      title={expiresAtUtc ? `Temporary: ends ${formatDate(expiresAtUtc)}` : undefined}
    >
      <BandMarker band={roleBand(name)} />
      {name}
      {expiresAtUtc && (
        <span className="inline-flex items-center gap-1 font-normal text-muted-foreground">
          <ClockIcon className="size-3" aria-hidden="true" />
          <span className="sr-only">until</span>
          {formatDate(expiresAtUtc).replace(/ \d{4}$/, '')}
        </span>
      )}
    </span>
  );
}

/** Green only ever means "granted" or "active"; everything else stays neutral. */
export function StatusDot({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        on ? 'bg-granted shadow-[0_0_0_3px_var(--granted-soft)]' : 'bg-muted-foreground/35',
        className,
      )}
    />
  );
}

export function ActiveStatus({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <StatusDot on={active} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/** Shown when the API answers 403: names the missing permission and offers to request it. */
export function AccessDenied({ what, permission, requestable = true }: { what: string; permission: string; requestable?: boolean }) {
  return (
    <Alert className="border-denied/30 bg-denied-soft">
      <LockIcon className="text-denied" />
      <AlertTitle>You can&apos;t view {what}</AlertTitle>
      <AlertDescription>
        <p>
          This needs the <PermissionCode code={permission} /> permission, which none of your roles include.
        </p>
        {requestable && (
          <p className="mt-2">
            <Link
              href={`/app/access-requests?new=1&permission=${encodeURIComponent(permission)}`}
              className="font-medium text-foreground underline underline-offset-4 hover:text-brand"
            >
              Request access
            </Link>
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Super admins have no organization of their own, so organization-scoped pages explain that instead. */
export function OrganizationRequired({ what }: { what: string }) {
  return (
    <Alert>
      <Building2Icon />
      <AlertTitle>{what} belong to an organization</AlertTitle>
      <AlertDescription>
        <p>Super admins work across organizations. Sign in as an organization admin to manage {what.toLowerCase()}.</p>
      </AlertDescription>
    </Alert>
  );
}

export function ApiErrorNotice({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>The API returned an error</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
      </AlertDescription>
    </Alert>
  );
}
