namespace AccessHub.Domain.Constants;

/// <summary>
/// Maximum string lengths, shared by the EF Core column configuration and the request validators,
/// so over-long input is rejected with a 400 instead of failing inside SQL Server.
/// </summary>
public static class FieldLengths
{
    /// <summary>Matches the column size ASP.NET Core Identity uses for Email/UserName.</summary>
    public const int Email = 256;
    public const int PersonName = 200;
    public const int OrganizationName = 200;
    public const int OrganizationSlug = 100;
    public const int RoleName = 100;
    public const int PermissionCode = 100;
    public const int PermissionDisplayName = 200;
    public const int InvoiceNumber = 50;
    public const int CustomerName = 200;
    public const int AuditAction = 100;
    public const int AuditEntityType = 100;
    public const int AccessRequestReason = 500;
    public const int Accent = 20;
}
