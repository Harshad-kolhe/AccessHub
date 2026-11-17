'use server';

import { refresh } from 'next/cache';
import { apiSend } from '@/lib/api';
import type { ActionResult } from '@/lib/types';

export interface CreateInvoiceInput {
  number: string;
  customerName: string;
  amount: number;
}

/**
 * Server Actions are public endpoints, so this forwards only the expected fields. The API authenticates the
 * caller (token from the session cookie), checks invoices.write and validates the body.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<ActionResult> {
  const result = await apiSend(
    '/api/invoices',
    'POST',
    {
      number: String(input?.number ?? ''),
      customerName: String(input?.customerName ?? ''),
      amount: Number(input?.amount),
    },
    'Failed to create invoice.',
  );

  if (result.ok) refresh(); // re-render the page with the new row
  return result;
}
