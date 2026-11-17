namespace AccessHub.Domain.Entities;

/// <summary>
/// One link in a rotating refresh-token chain. Every token issued from one sign-in shares a
/// <see cref="FamilyId"/>, so a family is one device session. Only a hash of the token is stored.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid FamilyId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? RevokedReason { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public bool IsActive(DateTime nowUtc) => RevokedAtUtc is null && ExpiresAtUtc > nowUtc;
}
