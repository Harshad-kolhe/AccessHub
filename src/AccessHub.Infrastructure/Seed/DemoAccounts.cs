using Microsoft.Extensions.Configuration;

namespace AccessHub.Infrastructure.Seed;

/// <summary>
/// On a public demo (Demo:Enabled) the three demo accounts are shared by every visitor, so nobody may lock the
/// others out: no two-factor sign-in, no password change, no deactivation. Everything else (roles, requests,
/// invoices) stays open to try, and <see cref="Jobs.DemoResetJob"/> restores the demo data every night.
/// </summary>
public static class DemoAccounts
{
    public static readonly string[] Emails = [DataSeeder.SuperAdminEmail, DataSeeder.AcmeAdminEmail, DataSeeder.AcmeViewerEmail];

    public static bool Enabled(IConfiguration configuration) => configuration.GetValue("Demo:Enabled", false);

    public static bool IsProtected(IConfiguration configuration, string? email) =>
        Enabled(configuration) && email is not null && Emails.Contains(email, StringComparer.OrdinalIgnoreCase);
}
