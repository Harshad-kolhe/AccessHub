# AccessHub web

The admin console for the AccessHub API: Next.js 16 (App Router) with React 19, TypeScript, Tailwind CSS 4 and shadcn/ui.

It is a **backend-for-frontend**. The browser only talks to this Next.js server, which keeps the API's access and refresh tokens in httpOnly cookies and calls the .NET API server-to-server. Browser scripts never see a token. The one direct connection from the browser is the realtime hub, opened with a short-lived ticket.

## Run

```powershell
npm ci
npm run dev        # http://localhost:3000
```

The API must be running (see the [root README](../README.md)). To point at a different API, copy `.env.example` to `.env.local`.

| Variable | Default | Meaning |
|---|---|---|
| `API_URL` | `http://localhost:5177` | The API as this server reaches it (in Docker: `http://api:8080`) |
| `PUBLIC_API_URL` | `API_URL` | The API as the browser reaches it, for the realtime hub and Google/Microsoft sign-in |
| `COOKIE_SECURE` | `true` in production | Set `false` to serve production builds over plain HTTP on a host other than localhost |

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check, build, and prerender the static pages (standalone output for Docker) |
| `npm run lint` | ESLint (Next.js core web vitals, TypeScript and React Compiler rules) |

## How it fits together

| Piece | Where | Role |
|---|---|---|
| Session cookies | `src/lib/session-cookies.ts`, `src/lib/session.ts` | Write, read, renew and clear the httpOnly access and refresh tokens |
| Proxy | `src/proxy.ts` | Before rendering: renews a token that is about to expire, keeps signed-out visitors out of `/app` |
| API client | `src/lib/api.ts` | Server-only fetch helpers; a rejected token goes through `/auth/refresh` (pages) or is renewed and retried (actions); problem details become messages |
| Route handlers | `src/app/auth/*`, `src/app/app/audit/export` | Session renewal, realtime tickets, the Google/Microsoft callback, the CSV download |
| Current user | `src/lib/auth.ts` | `getCurrentUser()`, loaded once per request from `/api/auth/me` |
| Server Actions | `src/app/**/actions.ts` | Every write; each checks ids and forwards only the expected fields |
| Realtime | `src/components/console/realtime-bridge.tsx` | SignalR connection, toasts, and `router.refresh()` when something changes |
| Pages | `src/app/app/**/page.tsx` | Static frame and title, with user-specific sections streamed behind `<Suspense>` |
| UI kit | `src/components/ui` | shadcn/ui components (Radix primitives), owned by this repo |
| Design tokens | `src/app/globals.css` | Ink and paper palette, accent presets, granted/denied colors, role clearance bands |

## Rendering

`next.config.ts` enables Cache Components, so `npm run build` reports the auth pages as fully static, and every `/app/*` page as a partial prerender: a static shell with user-specific content streamed at request time. Tables are Server Components; dialogs, menus, charts and the realtime connection are the only client code.

## Appearance and layout

The palette button switches light, dark or system mode (next-themes) and one of four accent colors. An organization can choose its accent (Organizations page), which applies unless the person picked their own. A small inline script applies the accent before the first paint, so the page never flashes the default color.

Every page works from 360-pixel phones up: tables become cards below 1024 pixels, and the end-to-end suite checks that nothing sticks out of the screen at 360, 768 and 1280 pixels.
