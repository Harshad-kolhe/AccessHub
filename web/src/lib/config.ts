/**
 * Base URL of the .NET API as this server reaches it (in Docker: the service name). Read only on the server;
 * no client component imports this module.
 */
export const API_URL = (process.env.API_URL ?? 'http://localhost:5177').replace(/\/+$/, '');

/**
 * The same API as the browser reaches it. Browsers call it for two things only: the realtime hub (with a
 * short-lived ticket) and the redirect to Google or Microsoft sign-in. Everything else goes through Next.js.
 */
export const PUBLIC_API_URL = (process.env.PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:5177').replace(/\/+$/, '');
