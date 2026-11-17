import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A titled card: the console's standard container for a list, a chart or a form section. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-xl border bg-card', className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg leading-tight font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn('px-5 py-4', bodyClassName)}>{children}</div>
    </section>
  );
}

/** A labelled number. Proportional figures on purpose: tabular digits look loose at this size. */
export function StatTile({
  label,
  value,
  context,
  href,
}: {
  label: string;
  value: number | string;
  context?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-4xl leading-none font-semibold tracking-tight">{value}</p>
      {context && <div className="mt-2 text-sm text-muted-foreground">{context}</div>}
    </>
  );
  return href ? (
    <a
      href={href}
      className="block rounded-xl border bg-card px-5 py-4 transition-colors outline-none hover:border-brand/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </a>
  ) : (
    <div className="rounded-xl border bg-card px-5 py-4">{body}</div>
  );
}

/** A chart's accessible twin: the same numbers as a table, collapsed by default. */
export function TableView({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="group mt-3">
      <summary className="w-fit cursor-pointer text-sm text-muted-foreground select-none hover:text-foreground">View as table</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              {columns.map((column, index) => (
                <th key={column} scope="col" className={cn('px-3 py-1.5 font-medium', index === 0 ? 'text-left' : 'text-right')}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row" className="px-3 py-1.5 text-left font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className="px-3 py-1.5 text-right tabular">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
