'use client';

import { useState } from 'react';
import { CheckIcon, PencilIcon } from 'lucide-react';
import { FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ACCENTS } from '@/lib/appearance';
import type { Organization } from '@/lib/types';
import { cn } from '@/lib/utils';
import { createOrganization, updateOrganization, type OrganizationInput } from './actions';

/** The organization's accent: the console wears it for everyone in the tenant unless they pick their own. */
function AccentField({ value, onChange }: { value: string; onChange: (accent: string) => void }) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Accent</FieldLegend>
      <div className="flex gap-2" role="radiogroup" aria-label="Accent">
        {ACCENTS.map((accent) => {
          const selected = value === accent.id;
          return (
            <button
              key={accent.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={accent.label}
              title={accent.label}
              onClick={() => onChange(accent.id)}
              className={cn(
                'grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'ring-2 ring-foreground/70',
              )}
              style={{ backgroundColor: accent.swatch }}
            >
              {selected && <CheckIcon className="size-4" />}
            </button>
          );
        })}
      </div>
      <FieldDescription>People in the organization see it in their console, unless they chose an accent themselves.</FieldDescription>
    </FieldSet>
  );
}

function NameAndSlug({ form, setForm, idPrefix }: { form: OrganizationInput; setForm: (form: OrganizationInput) => void; idPrefix: string }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
        <Input id={`${idPrefix}-name`} autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-slug`}>Slug</FieldLabel>
        <Input
          id={`${idPrefix}-slug`}
          autoComplete="off"
          placeholder="acme-corp"
          className="font-mono"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
        <FieldDescription>Letters, numbers and single hyphens. It is stored in lowercase.</FieldDescription>
      </Field>
    </>
  );
}

const empty: OrganizationInput = { name: '', slug: '', accent: 'cobalt' };

export function CreateOrganizationDialog() {
  const [form, setForm] = useState(empty);
  return (
    <FormDialog
      triggerLabel="New organization"
      title="New organization"
      description="A new tenant with its own people, roles and data. Nothing in it is visible to other organizations."
      submitLabel="Create organization"
      successMessage={() => `${form.name} created`}
      onSubmit={() => createOrganization(form)}
      onClose={() => setForm(empty)}
    >
      <NameAndSlug form={form} setForm={setForm} idPrefix="new-org" />
      <AccentField value={form.accent} onChange={(accent) => setForm({ ...form, accent })} />
    </FormDialog>
  );
}

export function EditOrganizationButton({ organization }: { organization: Organization }) {
  const initial: OrganizationInput = {
    name: organization.name,
    slug: organization.slug,
    accent: organization.accent ?? 'cobalt',
    isActive: organization.isActive,
  };
  const [form, setForm] = useState(initial);
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Edit ${organization.name}`}>
          <PencilIcon />
        </Button>
      }
      title={`Edit ${organization.name}`}
      submitLabel="Save organization"
      successMessage={() => `${form.name} saved`}
      onSubmit={() => updateOrganization(organization.id, form)}
      onClose={() => setForm(initial)}
    >
      <NameAndSlug form={form} setForm={setForm} idPrefix={`org-${organization.id}`} />
      <AccentField value={form.accent} onChange={(accent) => setForm({ ...form, accent })} />
      <Field orientation="horizontal">
        <Switch id={`org-${organization.id}-active`} checked={form.isActive !== false} onCheckedChange={(isActive) => setForm({ ...form, isActive })} />
        <FieldLabel htmlFor={`org-${organization.id}-active`} className="font-normal">
          Active
        </FieldLabel>
      </Field>
    </FormDialog>
  );
}
