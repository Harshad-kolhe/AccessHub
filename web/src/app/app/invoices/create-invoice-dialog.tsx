'use client';

import { useState } from 'react';
import { FormDialog } from '@/components/form-dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createInvoice } from './actions';

const empty = { number: '', customerName: '', amount: '' };

export function CreateInvoiceDialog() {
  const [form, setForm] = useState(empty);

  return (
    <FormDialog
      triggerLabel="New invoice"
      title="New invoice"
      description="The API checks invoices.write and validates every field before saving."
      submitLabel="Create invoice"
      successMessage={() => `Invoice ${form.number} created`}
      onSubmit={() => createInvoice({ number: form.number, customerName: form.customerName, amount: Number(form.amount) })}
      onClose={() => setForm(empty)}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field>
          <FieldLabel htmlFor="invoice-number">Number</FieldLabel>
          <Input
            id="invoice-number"
            autoComplete="off"
            placeholder="INV-003"
            className="font-mono"
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="invoice-amount">Amount</FieldLabel>
          <Input
            id="invoice-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            className="tabular"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="invoice-customer">Customer</FieldLabel>
        <Input id="invoice-customer" autoComplete="off" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
      </Field>
    </FormDialog>
  );
}
