# Job search guide: AccessHub on your resume

## Resume project entry (copy and adapt)

**AccessHub**: multi-tenant identity and access management (ASP.NET Core 10, EF Core, SQL Server, Next.js 16)
- Built organization-scoped RBAC with API-enforced permissions, EF Core query filters for tenant isolation, and a delegation guard that blocks privilege escalation
- Implemented 15-minute access tokens with rotating refresh tokens and reuse detection, instant revocation through security stamps, account lockout, rate limiting and TOTP two-factor sign-in
- Added an access-request workflow with time-limited roles (Hangfire), email invitations (MailKit) and live notifications (SignalR)
- Delivered a Next.js backend-for-frontend console with charts, an audit log with before/after diffs and CSV export, and responsive layouts
- Covered it with unit, integration (WebApplicationFactory, Testcontainers) and Playwright end-to-end tests in a GitHub Actions pipeline, shipped with Docker Compose

## LinkedIn headline

`.NET Developer | ASP.NET Core | SQL Server | Next.js | Building secure B2B access control (IAM/RBAC)`

## Two-minute interview story

> In ERP work I handled module access for users and roles, so I built AccessHub to do it properly for a multi-tenant SaaS. Organizations define roles from fine-grained permissions, and the API enforces every check. Permissions travel in a short-lived JWT, so most requests need no database lookup. To keep that safe, refresh tokens rotate with reuse detection, and a security-stamp fingerprint revokes old tokens the moment someone's roles change. People can ask for access, an admin approves it for a week, and a background job removes it when the week is over, with everything in the audit log. The Next.js server is a backend-for-frontend, so the browser never holds a token.

## Questions to be ready for

- Walk through what happens on each request, from cookie to policy to query filter.
- Why rotate refresh tokens, and what does reuse detection protect against?
- How do you stop a user with `users.write` from granting themselves admin?
- What changes if you run three API instances? (Distributed cache, SignalR backplane.)
- Why a backend-for-frontend instead of keeping the JWT in local storage?

## Weekly habit

- 15 to 20 tailored applications, each linking the GitHub repository
- Use the demo GIF and screenshots from the README in your portfolio or LinkedIn post
