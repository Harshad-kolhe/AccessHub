const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Server Actions are public endpoints, so ids from the browser are checked before they go into an API path.
 * Returns the id, or null when it is not a GUID.
 */
export function guidOrNull(value: unknown): string | null {
  return typeof value === 'string' && GUID.test(value) ? value : null;
}

/** An ISO timestamp in the future, or null (permanent). Anything else is rejected as undefined. */
export function expiryOrNull(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}
