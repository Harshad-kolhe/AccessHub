import { cn } from '@/lib/utils';

/** An access badge: card, lanyard slot and holder silhouette. Takes the current accent color. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7 shrink-0 text-brand', className)}>
      <rect x="6" y="2.5" width="20" height="27" rx="4.5" fill="currentColor" />
      <rect x="12.25" y="5.5" width="7.5" height="2.4" rx="1.2" fill="#fff" fillOpacity="0.85" />
      <circle cx="16" cy="15.2" r="3.6" fill="#fff" />
      <path d="M9.8 25.6c.9-3.4 3.4-5.3 6.2-5.3s5.3 1.9 6.2 5.3" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className="font-heading text-xl leading-none font-semibold tracking-tight">AccessHub</span>
    </span>
  );
}
