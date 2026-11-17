# Deploying AccessHub

A public demo needs three pieces: SQL Server, the API, and the Next.js app. This guide uses Azure for the first two and offers Vercel or Azure for the web app. Every setting is an environment variable; nothing secret goes into the repository.

## 1. Database: Azure SQL

1. Create an **Azure SQL Database** (the serverless General Purpose tier with auto-pause keeps a demo cheap; the free offer covers a small demo).
2. In **Networking**, allow Azure services to access the server.
3. Copy the ADO.NET connection string (SQL authentication) and keep it for the API.

The API applies its EF Core migrations on start, so there is no separate migration step. Hangfire creates its own `hangfire` schema in the same database.

## 2. API: Azure App Service (container)

Build and push the image (Azure Container Registry shown; Docker Hub or GitHub Container Registry work too):

```bash
az acr create --name <registry> --resource-group <group> --sku Basic
az acr build --registry <registry> --image accesshub-api:latest --file src/AccessHub.Api/Dockerfile .
```

Create a **Web App for Containers** (Linux) from that image, then set these **application settings**:

| Setting | Value |
|---|---|
| `ConnectionStrings__DefaultConnection` | The Azure SQL connection string |
| `Jwt__Key` | A random value of 32+ characters, e.g. `openssl rand -base64 48` |
| `WEBSITES_PORT` | `8080` |
| `App__WebBaseUrl` | The web app's URL, e.g. `https://accesshub.vercel.app` (used in email links) |
| `Cors__Origins__0` | The same web app URL (the realtime hub accepts it) |
| `OpenApi__Enabled` | `true` to publish the API reference at `/scalar` |
| `Demo__Enabled` | `true` for a public demo: protects the demo accounts and resets the data nightly |
| `RateLimiting__AuthPermitPerMinute` | `20` (the default) |
| `Email__Smtp__Host`, `Email__Smtp__Port`, `Email__Smtp__UserName`, `Email__Smtp__Password`, `Email__Smtp__UseSsl`, `Email__From` | Optional: an SMTP service (SendGrid, Mailgun, Azure Communication Services). Without them, emails go to the log. |
| `Authentication__Google__ClientId` / `ClientSecret`, `Authentication__Microsoft__ClientId` / `ClientSecret` | Optional: external sign-in. Register `https://<api-host>/signin-google` and `https://<api-host>/signin-microsoft` as redirect URIs. |

Also:

- Turn on **Web sockets** (Configuration, General settings) for SignalR.
- Set the **health check path** to `/health/ready`.
- Keep one instance: the token-state cache, external sign-in codes and SignalR live in memory (see Known limitations in the README).

**Rate limits behind a proxy.** The API trusts `X-Forwarded-For` only from the networks in `ForwardedHeaders__TrustedNetworks__*` (loopback by default). Behind App Service's front end that means the limits count per front-end address, so every visitor shares one budget: safe, but strict. For a busy public demo, raise `RateLimiting__AuthPermitPerMinute` (to 60, say) rather than trusting every network, which would let callers spoof their address.

## 3. Web app

### Option A: Vercel

1. Import the repository and set the **root directory** to `web`.
2. Environment variables:

| Variable | Value |
|---|---|
| `API_URL` | `https://<api-host>` |
| `PUBLIC_API_URL` | `https://<api-host>` (the browser connects to the realtime hub here) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Optional: a fixed key (`openssl rand -base64 32`), needed when several instances serve the app |

`output: 'standalone'` is ignored by Vercel, which builds the app its own way.

### Option B: Azure App Service or Container Apps

```bash
az acr build --registry <registry> --image accesshub-web:latest web
```

Run it with `PORT=3000`, `WEBSITES_PORT=3000`, `API_URL` and `PUBLIC_API_URL` as above. Azure Static Web Apps also hosts Next.js, as a hybrid app with a managed backend.

## 4. Check it

1. `https://<api-host>/health/ready` answers `Healthy` with a database check.
2. The web app's sign-in page shows the three demo badges; each signs in.
3. The header shows **Live**: the realtime connection works (if it says Offline, check web sockets and `Cors__Origins__0`).
4. Ask for access as the viewer in one browser and approve it as the admin in another: both get a notification.

## CI and the demo

GitHub Actions ([ci.yml](../.github/workflows/ci.yml)) builds and tests every push. To deploy from CI, add a job after `e2e` that runs the `az acr build` commands with an Azure service principal stored in repository secrets (`azure/login`), then restarts the web app.
