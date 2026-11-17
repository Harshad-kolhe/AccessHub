import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Placeholder while a table streams in. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-busy="true" aria-label="Loading">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-6 border-b px-4 py-4 last:border-0">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="grid gap-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
