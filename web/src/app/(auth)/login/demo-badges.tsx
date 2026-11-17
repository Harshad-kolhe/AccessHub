'use client';

import { useActionState, type CSSProperties } from 'react';
import { BandMarker, roleBand, type Band } from '@/components/access';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { signInWithDemoBadge, type AuthFormState } from '../actions';

const BAND_FILL: Record<Band, string> = {
  cobalt: 'bg-band-cobalt',
  teal: 'bg-band-teal',
  violet: 'bg-band-violet',
  amber: 'bg-band-amber',
  rose: 'bg-band-rose',
  slate: 'bg-band-slate',
};

const BADGES: { account: string; name: string; initials: string; role: string; organization: string; permissions: number; band: Band; tilt: string }[] = [
  { account: 'org-admin', name: 'Acme Admin', initials: 'AA', role: 'OrgAdmin', organization: 'Acme Corp', permissions: 7, band: roleBand('OrgAdmin'), tilt: '-2.5deg' },
  { account: 'viewer', name: 'Acme Viewer', initials: 'AV', role: 'Viewer', organization: 'Acme Corp', permissions: 4, band: roleBand('Viewer'), tilt: '1.5deg' },
  { account: 'super-admin', name: 'Super Admin', initials: 'SA', role: 'Platform', organization: 'Every organization', permissions: 8, band: 'amber', tilt: '-1deg' },
];

const initialState: AuthFormState = {};

/**
 * Demo accounts as access badges hanging from lanyards. Each badge is a submit button that signs in as that
 * account (credentials stay in the Server Action). They straighten on hover or keyboard focus.
 */
export function DemoBadges() {
  const [state, formAction, pending] = useActionState(signInWithDemoBadge, initialState);

  return (
    <form
      action={(formData) => {
        // Come back to the page that sent the visitor to sign in (read on submit, so the badges stay prerendered).
        formData.set('next', new URLSearchParams(window.location.search).get('next') ?? '');
        formAction(formData);
      }}
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-20 pt-16 sm:grid-cols-3">
        {BADGES.map((badge) => (
          <div key={badge.account} className="flex justify-center">
            <button
              type="submit"
              name="account"
              value={badge.account}
              disabled={pending}
              aria-label={`Sign in as ${badge.name}, ${badge.role}`}
              style={{ '--tilt': badge.tilt } as CSSProperties}
              className="relative w-full max-w-52 origin-[50%_-4rem] rotate-(--tilt) rounded-2xl bg-white pb-4 text-center text-[#14202e] shadow-[0_22px_45px_-18px_rgb(0_0_0/0.8)] transition-[rotate,translate] duration-300 ease-out outline-none hover:-translate-y-1 hover:rotate-0 focus-visible:rotate-0 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-sidebar disabled:opacity-75 dark:bg-[#e9eef5]"
            >
              {/* Lanyard strap and clip, drawn in the role's clearance color. */}
              <span aria-hidden="true" className={cn('absolute -top-16 left-1/2 h-[5.4rem] w-3 -translate-x-1/2 rounded-b-sm', BAND_FILL[badge.band])} />
              <span aria-hidden="true" className="absolute top-5 left-1/2 h-2.5 w-6 -translate-x-1/2 rounded-[3px] bg-[#b9c2ce] ring-1 ring-black/15" />
              <span aria-hidden="true" className={cn('block h-3 rounded-t-2xl', BAND_FILL[badge.band])} />
              <span aria-hidden="true" className="mx-auto mt-3 block h-2 w-12 rounded-full bg-sidebar" />

              <span className="mx-auto mt-5 grid size-14 place-items-center rounded-full bg-[#14202e] font-heading text-lg font-semibold text-white">
                {badge.initials}
              </span>
              <span className="mt-3 block px-3 font-heading text-lg leading-tight font-semibold">{badge.name}</span>
              <span className="mt-0.5 block px-3 text-xs text-[#586477]">{badge.organization}</span>

              <span className="mx-4 mt-4 flex flex-col items-center gap-1 border-t border-[#dce2ea] pt-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <BandMarker band={badge.band} />
                  {badge.role}
                </span>
                <span className="text-[#586477] tabular">{badge.permissions} permissions</span>
              </span>
            </button>
          </div>
        ))}
      </div>
      <p className="mt-6 flex min-h-5 items-center gap-2 text-sm" aria-live="polite">
        {pending ? (
          <>
            <Spinner className="size-4" /> Signing in…
          </>
        ) : (
          state.error && <span className="text-red-300">{state.error}</span>
        )}
      </p>
    </form>
  );
}
