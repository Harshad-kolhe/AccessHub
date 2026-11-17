'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { PERMISSION_CATALOG } from '@/lib/permissions';

/** Organization roles can grant every permission except the platform-wide organizations.manage. */
const ORGANIZATION_PERMISSIONS = PERMISSION_CATALOG.filter((permission) => !permission.platform);

/** Resources as rows, read / write as columns: how people think about access. */
const ROWS = (() => {
  const rows = new Map<string, { resource: string; read?: string; write?: string }>();
  for (const permission of ORGANIZATION_PERMISSIONS) {
    const [, action] = permission.code.split('.');
    const row = rows.get(permission.resource) ?? { resource: permission.resource };
    if (action === 'read' || action === 'write') row[action] = permission.code;
    rows.set(permission.resource, row);
  }
  return [...rows.values()];
})();

/**
 * Picks a role's permissions. Permissions the editor doesn't hold are disabled: the API refuses to let anyone
 * hand out access they don't have.
 */
export function PermissionPicker({
  value,
  onChange,
  blocked = [],
}: {
  value: string[];
  onChange: (codes: string[]) => void;
  /** Codes the editor may not add or remove. */
  blocked?: string[];
}) {
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <FieldSet>
      <FieldLegend variant="label">Permissions</FieldLegend>
      <FieldDescription>
        Managing other organizations (<code className="font-mono text-xs">organizations.manage</code>) is reserved for super admins.
        {blocked.length > 0 && ' Greyed-out boxes are permissions you don’t hold yourself.'}
      </FieldDescription>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Resource
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-center font-medium">
                Read
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-center font-medium">
                Write
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROWS.map((row) => (
              <tr key={row.resource}>
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {row.resource}
                </th>
                {(['read', 'write'] as const).map((action) => {
                  const code = row[action];
                  return (
                    <td key={action} className="px-3 py-2 text-center">
                      {code ? (
                        <Checkbox
                          aria-label={code}
                          checked={value.includes(code)}
                          disabled={blocked.includes(code)}
                          title={blocked.includes(code) ? 'You don’t hold this permission' : undefined}
                          onCheckedChange={() => toggle(code)}
                        />
                      ) : (
                        <span className="text-muted-foreground" aria-label="Not applicable">
                          –
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FieldSet>
  );
}
