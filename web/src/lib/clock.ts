import 'server-only';

/**
 * The current time for request-time rendering (relative timestamps such as "5 min ago").
 * Server Components render once per request, so reading the clock is safe there; the React purity lint
 * rule exists for client components that re-render, which is why the call is kept behind this helper.
 */
export function requestTime(): number {
  return Date.now();
}
