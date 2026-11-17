'use server';

import { refresh } from 'next/cache';
import { apiSend } from '@/lib/api';
import { ACCENTS } from '@/lib/appearance';
import { guidOrNull } from '@/lib/ids';
import type { ActionResult } from '@/lib/types';

export interface OrganizationInput {
  name: string;
  slug: string;
  accent: string;
  isActive?: boolean;
}

const accentOf = (value: unknown) => (ACCENTS.some((accent) => accent.id === value) && value !== 'cobalt' ? String(value) : null);

function done<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) refresh();
  return result;
}

/** Requires organizations.manage (super admins); the API enforces it and validates the slug. */
export async function createOrganization(input: OrganizationInput): Promise<ActionResult> {
  return done(
    await apiSend(
      '/api/organizations',
      'POST',
      { name: String(input?.name ?? '').trim(), slug: String(input?.slug ?? '').trim(), accent: accentOf(input?.accent) },
      'The organization could not be created.',
    ),
  );
}

export async function updateOrganization(organizationId: string, input: OrganizationInput): Promise<ActionResult> {
  const id = guidOrNull(organizationId);
  if (!id) return { ok: false, error: 'That organization is not valid.' };
  return done(
    await apiSend(
      `/api/organizations/${id}`,
      'PUT',
      {
        name: String(input?.name ?? '').trim(),
        slug: String(input?.slug ?? '').trim(),
        isActive: input?.isActive !== false,
        accent: accentOf(input?.accent),
      },
      'The organization could not be saved.',
    ),
  );
}
