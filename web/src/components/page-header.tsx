import type { ReactNode } from 'react';

/** Title and one-line description are static (prerendered); `action` is usually a permission-gated button. */
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex min-h-9 items-center gap-2">{action}</div>}
    </div>
  );
}
