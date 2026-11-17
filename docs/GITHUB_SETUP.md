# GitHub repository settings

The repository is at https://github.com/Harshad-kolhe/AccessHub. These settings make it read well as a portfolio project.

## About (the box on the right of the repository page)

- **Description:** `Multi-tenant IAM for B2B SaaS: ASP.NET Core 10 API + Next.js 16 console. RBAC, rotating refresh tokens, 2FA, access requests with temporary roles, SignalR, audit log.`
- **Website:** the live demo's URL, once deployed (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- **Topics:** `aspnet-core`, `dotnet`, `csharp`, `nextjs`, `react`, `typescript`, `rbac`, `iam`, `authentication`, `authorization`, `jwt`, `multi-tenant`, `entity-framework-core`, `sql-server`, `signalr`, `hangfire`, `shadcn-ui`, `tailwindcss`, `playwright`, `docker`

With the GitHub CLI (`winget install GitHub.cli`, then `gh auth login`):

```powershell
gh repo edit Harshad-kolhe/AccessHub `
  --description "Multi-tenant IAM for B2B SaaS: ASP.NET Core 10 API + Next.js 16 console. RBAC, rotating refresh tokens, 2FA, access requests with temporary roles, SignalR, audit log." `
  --add-topic aspnet-core,dotnet,csharp,nextjs,react,typescript,rbac,iam,authentication,authorization,jwt,multi-tenant,entity-framework-core,sql-server,signalr,hangfire,shadcn-ui,tailwindcss,playwright,docker
```

## Continuous integration

[.github/workflows/ci.yml](../.github/workflows/ci.yml) runs on every push to `main` and on pull requests:

| Job | Steps |
|---|---|
| API build and tests | Restore, build with warnings as errors, unit and integration tests (SQL Server through Testcontainers), vulnerable-package check |
| Web lint, types and build | `npm ci`, ESLint, `tsc --noEmit`, `next build`, `npm audit` on production dependencies |
| End-to-end | `docker compose up --build`, wait for health, Playwright tests; the report is uploaded when something fails |

The README's CI badge shows the latest result on `main`.

## Branch protection (recommended)

In **Settings, Branches**, protect `main`: require a pull request and the three CI checks before merging. Work then happens on branches:

```powershell
git switch -c feature/my-change
git push -u origin feature/my-change
gh pr create --fill
```

## Pinned repository

On your profile, **Customize your pins** and pin AccessHub, so it is the first thing visitors see.
