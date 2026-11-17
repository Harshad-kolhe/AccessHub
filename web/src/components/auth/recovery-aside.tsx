/** Context for the password-recovery pages: what the link does, and what happens to existing sessions. */
export function RecoveryAside() {
  return (
    <div className="max-w-md">
      <h2 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">Locked out?</h2>
      <ul className="mt-6 grid gap-3 text-sm text-sidebar-foreground">
        <li className="rounded-lg bg-white/5 px-4 py-3">The reset link works once and expires after 2 hours.</li>
        <li className="rounded-lg bg-white/5 px-4 py-3">Changing the password signs out every device and lifts a lockout.</li>
        <li className="rounded-lg bg-white/5 px-4 py-3">Locked after five wrong passwords? The lock also ends by itself after 15 minutes.</li>
      </ul>
    </div>
  );
}
