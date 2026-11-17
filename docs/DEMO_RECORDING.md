# Screenshots and the demo GIF

The README's screenshots (`docs/screenshots`) and the demo GIF (`docs/demo/accesshub-demo.gif`) are produced by two Playwright scripts, so they can be refreshed after any UI change.

## Before you record: fresh demo data

The scripts expect the seeded demo exactly as it starts: the viewer without the Billing role, Marcus's request still pending, and so on. Point the API at an **empty database** and let it seed on start, for example in `.env`:

```
ConnectionStrings__DefaultConnection='Server=.\SQLEXPRESS;Database=AccessHub_Demo;Trusted_Connection=True;TrustServerCertificate=True'
```

The GIF approves an access request, so record it last, and drop the database (or reset it) before recording again.

## Automated

From the repository root:

```powershell
.\scripts\record-demo.ps1
```

It installs the recorder's dependencies, starts the API and the production build of the web app, runs both scripts, then stops the servers.

Or step by step, with the API and the web app already running on http://localhost:5177 and http://localhost:3000:

```powershell
cd scripts
npm install
npx playwright install chromium
npm run screenshots    # docs/screenshots/*.png
npm run record         # docs/demo/accesshub-demo.gif
```

Use the production build of the web app (`npm run build`, then `node .next/standalone/server.js` after copying `.next/static` into `.next/standalone/.next/static`): the development server adds an indicator to every page.

## What the GIF shows (about 30 seconds)

1. Sign in with the **Acme Admin** badge; the dashboard loads and the header shows **Live**.
2. The viewer asks for the Billing role (the script sends it through the API, as if from another computer). The admin gets a live notification and clicks **Review**.
3. Approve it for one week, with a note.
4. **Permission matrix:** add `invoices.read` to Support, then **Undo**.
5. **Access checker:** the viewer can now create invoices, through the temporary Billing grant.
6. **Ctrl+K**, type "audit", Enter: the audit log.

The script encodes the video at 10 frames per second and 960 pixels wide with ffmpeg (bundled through `ffmpeg-static`).
