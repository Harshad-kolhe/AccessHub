namespace AccessHub.Application.Interfaces;

/// <summary>Names of EF Core query filters, so code can switch off exactly one of them.</summary>
public static class QueryFilters
{
    /// <summary>
    /// Restricts organization-owned data to the caller's organization. Ignore it only where crossing tenants is
    /// the point: resolving a user's own permissions at sign-in, background jobs and seeding.
    /// </summary>
    public const string Tenant = "Tenant";

    public static readonly string[] TenantOnly = [Tenant];
}
