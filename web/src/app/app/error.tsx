'use client'; // error boundaries must be Client Components

import { useEffect } from 'react';
import { ServerCrashIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/** Shown inside the console frame when a page fails to load, usually because the API is down. */
export default function ConsoleError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Empty className="rounded-xl border border-dashed bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ServerCrashIcon />
        </EmptyMedia>
        <EmptyTitle>This page could not load</EmptyTitle>
        <EmptyDescription>The AccessHub API did not answer. Check that it is running, then try again.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => retry()}>Try again</Button>
      </EmptyContent>
    </Empty>
  );
}
