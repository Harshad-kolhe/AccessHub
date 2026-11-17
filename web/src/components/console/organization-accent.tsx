'use client';

import { useEffect } from 'react';
import { applyOrganizationAccent } from '@/lib/accent-store';

/**
 * Organizations choose an accent (Organizations page); the console wears it unless the person picked their own
 * in the appearance menu. It is remembered locally, so the next page load paints it before hydration.
 */
export function OrganizationAccent({ accent }: { accent: string | null }) {
  useEffect(() => {
    applyOrganizationAccent(accent);
  }, [accent]);
  return null;
}
