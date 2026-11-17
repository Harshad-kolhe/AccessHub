'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { CheckIcon, MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { choosePersonalAccent, clearPersonalAccent, hasPersonalAccent, readAccent, subscribeAccent } from '@/lib/accent-store';
import { ACCENTS, DEFAULT_ACCENT } from '@/lib/appearance';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
  { id: 'system', label: 'System', icon: MonitorIcon },
] as const;

const noopSubscribe = () => () => {};

export function AppearanceMenu({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const accent = useSyncExternalStore(subscribeAccent, readAccent, () => DEFAULT_ACCENT);
  const personal = useSyncExternalStore(subscribeAccent, hasPersonalAccent, () => false);
  // next-themes only knows the stored mode after hydration; render the selection once mounted.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Appearance">
          <PaletteIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-sm font-medium">Mode</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Color mode">
              {MODES.map(({ id, label, icon: Icon }) => {
                const selected = mounted && theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTheme(id)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected && 'bg-card text-foreground shadow-sm',
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium">Accent</p>
            <div className="flex gap-2" role="group" aria-label="Accent color">
              {ACCENTS.map(({ id, label, swatch }) => {
                const selected = mounted && accent === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={label}
                    title={label}
                    onClick={() => choosePersonalAccent(id)}
                    className={cn(
                      'grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-popover outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected && 'ring-2 ring-foreground/70',
                    )}
                    style={{ backgroundColor: swatch }}
                  >
                    {selected && <CheckIcon className="size-4" />}
                  </button>
                );
              })}
            </div>
            <p className="min-h-4 text-xs text-muted-foreground">
              {mounted && personal ? (
                <button type="button" className="underline-offset-4 hover:text-foreground hover:underline" onClick={clearPersonalAccent}>
                  Use the organization’s accent
                </button>
              ) : (
                'Following your organization’s accent.'
              )}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
