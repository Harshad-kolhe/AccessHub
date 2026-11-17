'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

/**
 * Choosing a person or a permission updates the URL; the server answers with the check. Both choices live in
 * local state, so picking the second before the first navigation finishes keeps the first. When the URL changes
 * from elsewhere (the command menu, the back button), the form follows it.
 */
export function CheckerForm({
  people,
  permissions,
  user,
  permission,
}: {
  people: { id: string; name: string; email: string }[];
  permissions: { code: string; label: string }[];
  user?: string;
  permission?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const fromUrl = { user: user ?? '', permission: permission ?? '' };
  const [selection, setSelection] = useState(fromUrl);
  const [lastUrl, setLastUrl] = useState(fromUrl);

  // Adopt a URL change made elsewhere; while our own navigations are in flight, an earlier one landing is ignored.
  if (lastUrl.user !== fromUrl.user || lastUrl.permission !== fromUrl.permission) {
    setLastUrl(fromUrl);
    if (!pending) setSelection(fromUrl);
  }

  const choose = (change: Partial<typeof selection>) => {
    const next = { ...selection, ...change };
    setSelection(next);
    const query = new URLSearchParams();
    if (next.user) query.set('user', next.user);
    if (next.permission) query.set('permission', next.permission);
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
  };

  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="checker-user">Person</FieldLabel>
        <Select value={selection.user} onValueChange={(value) => choose({ user: value })}>
          <SelectTrigger id="checker-user" className="w-full">
            <SelectValue placeholder="Pick a person" />
          </SelectTrigger>
          <SelectContent>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
                <span className="text-xs text-muted-foreground">{person.email}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="checker-permission" className="flex items-center gap-2">
          Permission
          {pending && <Spinner className="size-3.5" />}
        </FieldLabel>
        <Select value={selection.permission} onValueChange={(value) => choose({ permission: value })}>
          <SelectTrigger id="checker-permission" className="w-full">
            <SelectValue placeholder="Pick a permission" />
          </SelectTrigger>
          <SelectContent>
            {permissions.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.label}
                <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FieldGroup>
  );
}
