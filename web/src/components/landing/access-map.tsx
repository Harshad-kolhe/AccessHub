'use client';

import { useState } from 'react';
import { BandMarker, StatusDot, roleBand, type Band } from '@/components/access';
import { cn } from '@/lib/utils';

const PERMISSIONS = [
  'users.read',
  'users.write',
  'roles.read',
  'roles.write',
  'invoices.read',
  'invoices.write',
  'audit.read',
  'organizations.manage',
];

const ROLES: { id: string; name: string; band: Band; summary: string; grants: string[] }[] = [
  {
    id: 'org-admin',
    name: 'Org admin',
    band: 'cobalt',
    summary: 'Runs one organization.',
    grants: PERMISSIONS.filter((code) => code !== 'organizations.manage'),
  },
  { id: 'billing', name: 'Billing', band: roleBand('Billing'), summary: 'A custom role: invoices only.', grants: ['invoices.read', 'invoices.write'] },
  { id: 'viewer', name: 'Viewer', band: 'slate', summary: 'Reads, never writes.', grants: ['users.read', 'roles.read', 'invoices.read', 'audit.read'] },
  { id: 'super-admin', name: 'Super admin', band: 'amber', summary: 'Operates every organization.', grants: PERMISSIONS },
];

const REQUESTS = [
  { method: 'GET', path: '/api/users', needs: 'users.read' },
  { method: 'POST', path: '/api/roles', needs: 'roles.write' },
  { method: 'GET', path: '/api/invoices', needs: 'invoices.read' },
  { method: 'POST', path: '/api/invoices', needs: 'invoices.write' },
  { method: 'GET', path: '/api/audit', needs: 'audit.read' },
  { method: 'GET', path: '/api/organizations', needs: 'organizations.manage' },
];

/** The landing page's signature element: pick a role, see its permissions and what the API answers. */
export function AccessMap() {
  const [selectedId, setSelectedId] = useState(ROLES[0].id);
  const selected = ROLES.find((role) => role.id === selectedId) ?? ROLES[0];

  return (
    <div className="rounded-2xl border bg-card shadow-[0_24px_60px_-32px_rgb(20_32_46/0.35)]">
      <div className="border-b p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">Pick a role to see what the API allows.</p>
        <div role="radiogroup" aria-label="Role" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((role) => {
            const active = role.id === selected.id;
            return (
              <button
                key={role.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedId(role.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-brand bg-brand-soft text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <BandMarker band={role.band} />
                {role.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="overflow-x-auto border-b p-4 sm:p-5 md:border-r md:border-b-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Permissions granted to each role</caption>
            <thead>
              <tr>
                <th scope="col" className="pb-2 text-left font-normal text-muted-foreground">Permission</th>
                {ROLES.map((role) => (
                  <th key={role.id} scope="col" className="w-10 pb-2 text-center font-normal">
                    <span className="sr-only">{role.name}</span>
                    <BandMarker band={role.band} className={cn('h-3.5', role.id === selected.id ? 'opacity-100' : 'opacity-40')} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((code) => (
                <tr key={code}>
                  <th scope="row" className="py-1.5 pr-3 text-left font-mono text-[0.78rem] font-normal whitespace-nowrap text-foreground/85">
                    {code}
                  </th>
                  {ROLES.map((role) => {
                    const granted = role.grants.includes(code);
                    const isSelected = role.id === selected.id;
                    return (
                      <td key={role.id} className={cn('py-1.5 text-center', isSelected && 'bg-brand-soft')}>
                        <span
                          className={cn(
                            'inline-block size-2.5 rounded-full',
                            granted ? 'bg-foreground' : 'border border-muted-foreground/40',
                            !isSelected && 'opacity-45',
                          )}
                        />
                        <span className="sr-only">{granted ? 'granted' : 'not granted'}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="min-w-0 p-4 sm:p-5">
          <p className="text-sm">
            <span className="font-medium">{selected.name}.</span>{' '}
            <span className="text-muted-foreground">{selected.summary}</span>
          </p>
          <ul className="mt-4 grid gap-2" aria-live="polite">
            {REQUESTS.map((request) => {
              const allowed = selected.grants.includes(request.needs);
              return (
                <li
                  key={request.method + request.path}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2 font-mono text-[0.78rem]"
                >
                  <span className="w-9 shrink-0 text-muted-foreground">{request.method}</span>
                  <span className="min-w-0 flex-1 truncate">{request.path}</span>
                  <span key={selected.id} className="inline-flex shrink-0 animate-flip-in items-center gap-1.5">
                    <StatusDot on={allowed} className={allowed ? '' : 'bg-denied shadow-[0_0_0_3px_var(--denied-soft)]'} />
                    <span className={allowed ? 'text-granted' : 'text-denied'}>{allowed ? '200' : '403'}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
