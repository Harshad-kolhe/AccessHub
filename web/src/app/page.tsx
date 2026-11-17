import Link from 'next/link';
import { Building2Icon, CircleCheckIcon, ScrollTextIcon, ShieldCheckIcon } from 'lucide-react';
import { AppearanceMenu } from '@/components/appearance-menu';
import { AccessMap } from '@/components/landing/access-map';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    title: 'You sign in',
    body: 'The Next.js server exchanges your password for a JWT and keeps it in an httpOnly cookie. Scripts in the browser never see it.',
  },
  {
    title: 'The server calls the API',
    body: 'Pages and forms run on the Next.js server, which attaches your token to every call to the ASP.NET Core API.',
  },
  {
    title: 'The API decides',
    body: 'Each endpoint requires one permission. Without it the answer is 403, and every admin change is written to the audit log.',
  },
];

const FEATURES = [
  {
    icon: Building2Icon,
    title: 'Organizations',
    body: 'Each tenant has its own users, roles and data. Super admins work across all of them.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Roles built from permissions',
    body: 'Combine permissions such as invoices.read into roles. Platform permissions stay with super admins.',
  },
  {
    icon: ScrollTextIcon,
    title: 'Audit log',
    body: 'Changes to users, roles and organizations are recorded with who made them.',
  },
  {
    icon: CircleCheckIcon,
    title: 'Validation',
    body: 'Bad input gets a specific message from the API before anything is saved.',
  },
];

const STACK = [
  { title: 'API', items: ['.NET 10, ASP.NET Core', 'EF Core 10, SQL Server', 'Identity and JWT', 'FluentValidation'] },
  { title: 'Web', items: ['Next.js 16, React 19', 'TypeScript', 'Tailwind CSS 4', 'shadcn/ui on Radix'] },
];

/** Public page with no session reads, so Next.js prerenders it to static HTML at build time. */
export default function LandingPage() {
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="AccessHub home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild className="hidden sm:inline-flex">
            <Link href="/register">Create an organization</Link>
          </Button>
          <AppearanceMenu />
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-14">
          <div>
            <h1 className="font-heading text-5xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl lg:text-[4.25rem]">
              Who can do what, in which organization.
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg text-muted-foreground">
              AccessHub gives every organization its own users and roles, builds those roles from fine-grained
              permissions, and checks them in the API on every request.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login">Try the demo</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">Create an organization</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">No sign-up needed: the demo has ready-made accounts.</p>
          </div>
          <AccessMap />
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">How a request is checked</h2>
            <ol className="mt-10 grid gap-10 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="font-heading text-5xl leading-none font-semibold text-brand tabular" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 max-w-[40ch] text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-14 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">Inside the console</h2>
            <dl className="mt-8 grid gap-7">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4">
                  <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                  <div>
                    <dt className="font-medium">{title}</dt>
                    <dd className="mt-1 max-w-[52ch] text-muted-foreground">{body}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">Built with</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              {STACK.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-medium text-muted-foreground">{group.title}</h3>
                  <ul className="mt-3 grid gap-2">
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>AccessHub is a portfolio project.</p>
          <a
            href="https://github.com/Harshad1732/AccessHub"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
