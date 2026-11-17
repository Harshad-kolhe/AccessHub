import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ScrollTextIcon } from 'lucide-react';
import { AccessDenied, ApiErrorNotice } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { requestTime } from '@/lib/clock';
import { formatDateTime, formatRelative } from '@/lib/format';
import { PermissionCodes } from '@/lib/permissions';
import type { AuditEvent, AuditFacets, Paged } from '@/lib/types';
import { AuditFilters } from './audit-filters';
import { capitalize, describeAuditEvent, type AuditDescription } from './describe';
import { ENTITY_LABELS, auditHref, auditQuery, parseAuditFilters } from './filters';

export const metadata: Metadata = { title: 'Audit log' };

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change to people, roles, access and organizations: who did it, when, and what it was before."
      />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <AuditLog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AuditLog({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const [events, facets, user] = await Promise.all([
    apiGet<Paged<AuditEvent>>(`/api/audit${auditQuery(params, { page: filters.page, pageSize: PAGE_SIZE })}`),
    apiGet<AuditFacets>('/api/audit/facets'),
    getCurrentUser(),
  ]);
  if (!events.ok) {
    return events.status === 403 ? (
      <AccessDenied what="the audit log" permission={PermissionCodes.AuditRead} />
    ) : (
      <ApiErrorNotice message={events.error} />
    );
  }

  const { items, total, page } = events.data;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const now = requestTime();
  const exportHref = `/app/audit/export${auditQuery(params)}`;

  return (
    <>
      {facets.ok && <AuditFilters filters={filters} facets={facets.data} exportHref={exportHref} />}

      {items.length === 0 ? (
        <EmptyState
          icon={ScrollTextIcon}
          title={total === 0 && !filters.from && !filters.actor && !filters.entity && !filters.action ? 'Nothing recorded yet' : 'Nothing matches these filters'}
          description="Changes to people, roles and organizations appear here as they happen."
        />
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {items.map((event) => (
            <AuditRow key={event.id} event={event} description={describeAuditEvent(event)} isYou={event.actorUserId === user.id} now={now} />
          ))}
        </ol>
      )}

      {total > 0 && (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground" aria-label="Pages">
          <p className="tabular">
            {first}–{last} of {total}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}>
              <Link href={auditHref(filters, { page: page - 1 })} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
                <ChevronLeftIcon />
                Newer
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={last >= total ? 'pointer-events-none opacity-50' : undefined}>
              <Link href={auditHref(filters, { page: page + 1 })} aria-disabled={last >= total} tabIndex={last >= total ? -1 : undefined}>
                Older
                <ChevronRightIcon />
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}

function AuditRow({ event, description, isYou, now }: { event: AuditEvent; description: AuditDescription; isYou: boolean; now: number }) {
  const { phrase, changes, details } = description;
  const hasMore = changes.length > 0 || details.length > 0;
  const actor = isYou ? 'You' : event.actorName;

  const summary = (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
      <time dateTime={event.createdAtUtc} title={formatDateTime(event.createdAtUtc)} className="text-sm text-muted-foreground tabular">
        {capitalize(formatRelative(event.createdAtUtc, now))}
      </time>
      <p className="min-w-0 text-sm">
        <span className="font-medium">{actor}</span> {phrase}
      </p>
      <span className="text-xs text-muted-foreground">{ENTITY_LABELS[event.entityType] ?? event.entityType}</span>
    </div>
  );

  return (
    <li className="px-5 py-3">
      {hasMore ? (
        <details className="group">
          <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
            {summary}
            <span className="mt-1 inline-block text-xs text-brand group-open:hidden sm:ml-[10rem]">
              {changes.length > 0 ? `Show what changed (${changes.length})` : 'Show details'}
            </span>
          </summary>
          <div className="mt-3 grid gap-3 sm:ml-[10rem]">
            {changes.length > 0 && (
              <table className="w-full max-w-2xl overflow-hidden rounded-lg border text-sm">
                <caption className="sr-only">What changed</caption>
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-1.5 text-left font-medium">
                      Field
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-left font-medium">
                      Before
                    </th>
                    <th scope="col" className="px-3 py-1.5 text-left font-medium">
                      After
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {changes.map((change) => (
                    <tr key={change.field} className="align-top">
                      <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">
                        {change.field}
                      </th>
                      {change.added || change.removed ? (
                        <td colSpan={2} className="px-3 py-2">
                          <span className="flex flex-wrap gap-1.5">
                            {change.removed?.map((item) => (
                              <span key={`-${item}`} className="rounded bg-denied-soft px-1.5 py-0.5 font-mono text-xs text-denied line-through decoration-denied/60">
                                <span className="sr-only">removed </span>
                                {item}
                              </span>
                            ))}
                            {change.added?.map((item) => (
                              <span key={`+${item}`} className="rounded bg-granted-soft px-1.5 py-0.5 font-mono text-xs text-granted">
                                <span className="sr-only">added </span>+{item}
                              </span>
                            ))}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-muted-foreground line-through decoration-muted-foreground/50">{change.before}</td>
                          <td className="px-3 py-2">{change.after}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {details.length > 0 && (
              <dl className="grid max-w-2xl grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                {details.map((detail) => (
                  <div key={detail.label} className="contents">
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd className="break-words">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </details>
      ) : (
        summary
      )}
    </li>
  );
}
