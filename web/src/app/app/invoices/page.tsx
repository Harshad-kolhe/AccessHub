import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { InboxIcon, ReceiptTextIcon } from 'lucide-react';
import { AccessDenied, ApiErrorNotice } from '@/components/access';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { formatAmount, formatDate } from '@/lib/format';
import { PermissionCodes, hasPermission } from '@/lib/permissions';
import type { Invoice } from '@/lib/types';
import { CreateInvoiceDialog } from './create-invoice-dialog';

export const metadata: Metadata = { title: 'Invoices' };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Sample business data behind organization-scoped permissions: reading needs invoices.read, creating needs invoices.write."
        action={
          <Suspense fallback={null}>
            <NewInvoiceButton />
          </Suspense>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <InvoiceList />
      </Suspense>
    </>
  );
}

async function NewInvoiceButton() {
  const user = await getCurrentUser();
  if (hasPermission(user, PermissionCodes.InvoicesWrite)) return <CreateInvoiceDialog />;
  if (user.isSuperAdmin || !hasPermission(user, PermissionCodes.InvoicesRead)) return null;

  // Can read but not create: offer the request flow instead of hiding the action.
  return (
    <Button asChild variant="outline">
      <Link href={`/app/access-requests?new=1&permission=${PermissionCodes.InvoicesWrite}`}>
        <InboxIcon />
        Request access to create invoices
      </Link>
    </Button>
  );
}

async function InvoiceList() {
  const invoices = await apiGet<Invoice[]>('/api/invoices');
  if (!invoices.ok) {
    return invoices.status === 403 ? (
      <AccessDenied what="invoices" permission={PermissionCodes.InvoicesRead} />
    ) : (
      <ApiErrorNotice message={invoices.error} />
    );
  }
  if (invoices.data.length === 0) {
    return <EmptyState icon={ReceiptTextIcon} title="No invoices yet" description="Create the first invoice to see a permission-checked write." />;
  }

  const total = invoices.data.reduce((sum, invoice) => sum + invoice.amount, 0);
  return (
    <>
      <ul className="grid gap-3 lg:hidden">
        {invoices.data.map((invoice) => (
          <li key={invoice.id} className="flex items-start justify-between gap-4 rounded-xl border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">{invoice.customerName}</p>
              <p className="font-mono text-xs text-muted-foreground">{invoice.number}</p>
            </div>
            <div className="text-right">
              <p className="tabular">{formatAmount(invoice.amount)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAtUtc)}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden rounded-xl border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="pr-5 text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.data.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="py-3 pl-5 font-mono text-[0.8rem]">{invoice.number}</TableCell>
                <TableCell className="font-medium">{invoice.customerName}</TableCell>
                <TableCell className="text-right tabular">{formatAmount(invoice.amount)}</TableCell>
                <TableCell className="pr-5 text-right text-muted-foreground tabular">{formatDate(invoice.createdAtUtc)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="hover:bg-transparent">
              <TableCell className="pl-5 text-muted-foreground" colSpan={2}>
                {invoices.data.length} invoices
              </TableCell>
              <TableCell className="text-right font-medium tabular">{formatAmount(total)}</TableCell>
              <TableCell className="pr-5" />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </>
  );
}
