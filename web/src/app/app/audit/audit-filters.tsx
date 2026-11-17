'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileDownIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { AuditFacets } from '@/lib/types';
import { ENTITY_LABELS, auditHref, type AuditFilters as Filters } from './filters';

const ALL = 'all';

/**
 * One row of filters above the log; every change updates the URL, so filtered views can be shared. The values
 * live in local state, so a second change made before the first navigation finishes keeps the first. When the
 * URL changes some other way ("Clear filters", the back button), the filters follow it.
 */
export function AuditFilters({ filters: fromUrl, facets, exportHref }: { filters: Filters; facets: AuditFacets; exportHref: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState(fromUrl);
  const urlKey = auditHref(fromUrl, { page: fromUrl.page });
  const [lastUrlKey, setLastUrlKey] = useState(urlKey);

  // Adopt a URL change made elsewhere; while our own navigations are in flight, an earlier one landing is ignored.
  if (lastUrlKey !== urlKey) {
    setLastUrlKey(urlKey);
    if (!pending) setFilters(fromUrl);
  }
  const set = (changes: Partial<Record<keyof Filters, string | undefined>>) => {
    const next = { ...filters, ...changes, page: 1 };
    setFilters(next);
    startTransition(() => router.replace(auditHref(next, {}), { scroll: false }));
  };
  const active = Boolean(filters.from || filters.to || filters.actor || filters.entity || filters.action);

  return (
    <div className="mb-4 rounded-xl border bg-card px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <Field>
          <FieldLabel htmlFor="audit-from">From</FieldLabel>
          <Input id="audit-from" type="date" value={filters.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-to">To</FieldLabel>
          <Input id="audit-to" type="date" value={filters.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-actor">Who</FieldLabel>
          <Select value={filters.actor ?? ALL} onValueChange={(value) => set({ actor: value === ALL ? undefined : value })}>
            <SelectTrigger id="audit-actor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Anyone</SelectItem>
              {facets.actors.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-entity">What</FieldLabel>
          <Select value={filters.entity ?? ALL} onValueChange={(value) => set({ entity: value === ALL ? undefined : value })}>
            <SelectTrigger id="audit-entity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Everything</SelectItem>
              {facets.entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {ENTITY_LABELS[type] ?? type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="audit-action">Action</FieldLabel>
          <Select value={filters.action ?? ALL} onValueChange={(value) => set({ action: value === ALL ? undefined : value })}>
            <SelectTrigger id="audit-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any action</SelectItem>
              {facets.actions.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.replace(/([a-z])([A-Z])/g, '$1 $2')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <Button asChild variant="outline">
            <a href={exportHref} download>
              <FileDownIcon />
              CSV
            </a>
          </Button>
        </div>
      </div>
      {(pending || active) && (
        <div className="mt-2 flex min-h-6 items-center gap-3 text-sm text-muted-foreground">
          {pending && <Spinner className="size-3.5" />}
          {active && (
            <Link href="/app/audit" className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline">
              <XIcon className="size-3.5" aria-hidden="true" />
              Clear filters
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
