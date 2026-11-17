import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-svh place-items-center px-4 text-center">
      <div>
        <p className="font-heading text-7xl font-semibold text-brand tabular">404</p>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-muted-foreground">Check the address, or start again from the home page.</p>
        <Button asChild className="mt-8">
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </div>
  );
}
