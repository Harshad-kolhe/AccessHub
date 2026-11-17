/** How each kind of audited item is named in the UI. */
export const ENTITY_LABELS: Record<string, string> = {
  User: 'People',
  Role: 'Roles',
  RoleAssignment: 'Role grants',
  AccessRequest: 'Access requests',
  Organization: 'Organizations',
  Invoice: 'Invoices',
};

/** URL filters of the audit log page, and how they map to the API's query string. Shared with the CSV export. */
export interface AuditFilters {
  from?: string;
  to?: string;
  actor?: string;
  entity?: string;
  action?: string;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WORD = /^[A-Za-z]{1,64}$/;

function one(params: Params, key: string): string | undefined {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) || undefined;
}

/** Reads the filters from the URL, dropping anything malformed. */
export function parseAuditFilters(params: Params): AuditFilters {
  const pick = (key: string, pattern: RegExp) => {
    const value = one(params, key);
    return value && pattern.test(value) ? value : undefined;
  };
  const page = Number.parseInt(one(params, 'page') ?? '1', 10);
  return {
    from: pick('from', DATE),
    to: pick('to', DATE),
    actor: pick('actor', GUID),
    entity: pick('entity', WORD),
    action: pick('action', WORD),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** The API query string for these filters. Dates are whole UTC days; "to" includes the day it names. */
export function auditQuery(params: Params, { page, pageSize }: { page?: number; pageSize?: number } = {}): string {
  const filters = parseAuditFilters(params);
  const query = new URLSearchParams();
  if (filters.from) query.set('from', `${filters.from}T00:00:00Z`);
  if (filters.to) {
    const end = new Date(`${filters.to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    query.set('to', end.toISOString());
  }
  if (filters.actor) query.set('actorId', filters.actor);
  if (filters.entity) query.set('entityType', filters.entity);
  if (filters.action) query.set('action', filters.action);
  if (page) query.set('page', String(page));
  if (pageSize) query.set('pageSize', String(pageSize));
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** The page's own URL with some filters changed (undefined removes one). Changing a filter returns to page 1. */
export function auditHref(filters: AuditFilters, changes: Partial<Record<keyof AuditFilters, string | number | undefined>>): string {
  const next = { ...filters, page: 1, ...changes } as Record<string, string | number | undefined>;
  const query = new URLSearchParams();
  for (const key of ['from', 'to', 'actor', 'entity', 'action'] as const) {
    const value = next[key];
    if (value) query.set(key, String(value));
  }
  if (next.page && Number(next.page) > 1) query.set('page', String(next.page));
  const text = query.toString();
  return text ? `/app/audit?${text}` : '/app/audit';
}
