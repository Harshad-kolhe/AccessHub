import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppearanceMenu } from '@/components/appearance-menu';
import { Logo } from '@/components/logo';

/**
 * Split layout for sign-in and registration: an ink panel with context on one side, the form on the other.
 * On small screens the form comes first.
 */
export function AuthShell({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative order-2 overflow-hidden bg-sidebar text-sidebar-foreground lg:order-1">
        {/* A faint grid, echoing the role-by-permission matrix. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-size-[32px_32px]"
        />
        <div className="relative flex h-full flex-col gap-10 px-6 py-8 sm:px-10 lg:py-12 xl:px-14">
          <Link href="/" className="w-fit text-white" aria-label="AccessHub home">
            <Logo />
          </Link>
          <div className="flex flex-1 flex-col justify-center">{aside}</div>
        </div>
      </aside>
      <main className="order-1 flex flex-col px-6 py-6 sm:px-10 lg:order-2">
        <div className="flex justify-end">
          <AppearanceMenu />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
