'use client';

import { useState } from 'react';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const CHOICES = [
  { id: 'permanent', label: 'Until removed', days: null },
  { id: '1d', label: '1 day', days: 1 },
  { id: '7d', label: '1 week', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: 'date', label: 'Until a date', days: null },
] as const;

type Choice = (typeof CHOICES)[number]['id'];

/** The moment access ends for a choice, or null for permanent; `undefined` when the date is missing or past. */
function expiryFor(choice: Choice, date: string): string | null | undefined {
  if (choice === 'permanent') return null;
  if (choice === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    const end = new Date(`${date}T23:59:00Z`);
    return end.getTime() > Date.now() ? end.toISOString() : undefined;
  }
  const days = CHOICES.find((option) => option.id === choice)?.days ?? 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * How long a grant lasts. Temporary grants are removed by a background job when they end, and the audit log
 * records it.
 */
export function ExpiryPicker({
  idPrefix,
  legend = 'How long',
  onChange,
}: {
  idPrefix: string;
  legend?: string;
  /** The end as an ISO timestamp, null for permanent, or undefined while the choice is incomplete. */
  onChange: (expiresAtUtc: string | null | undefined) => void;
}) {
  const [choice, setChoice] = useState<Choice>('permanent');
  const [date, setDate] = useState('');

  const update = (nextChoice: Choice, nextDate: string) => {
    setChoice(nextChoice);
    setDate(nextDate);
    onChange(expiryFor(nextChoice, nextDate));
  };

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <RadioGroup value={choice} onValueChange={(value) => update(value as Choice, date)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CHOICES.map((option) => (
          <Field key={option.id} orientation="horizontal">
            <RadioGroupItem value={option.id} id={`${idPrefix}-${option.id}`} />
            <FieldLabel htmlFor={`${idPrefix}-${option.id}`} className="font-normal">
              {option.label}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {choice === 'date' && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-date`} className="sr-only">
            Last day
          </FieldLabel>
          <Input id={`${idPrefix}-date`} type="date" value={date} onChange={(event) => update('date', event.target.value)} className="w-44" />
          <FieldDescription>Access ends at the end of that day (UTC), within a year.</FieldDescription>
        </Field>
      )}
      {choice !== 'permanent' && choice !== 'date' && (
        <FieldDescription>A background job removes the role when the time is up, and the audit log records it.</FieldDescription>
      )}
    </FieldSet>
  );
}
