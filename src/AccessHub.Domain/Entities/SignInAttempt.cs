namespace AccessHub.Domain.Entities;

/// <summary>
/// Every sign-in attempt, successful or not. Feeds the security charts and the failed-sign-in count.
/// No foreign keys on purpose: attempts for unknown emails are recorded too, and history survives deletions.
/// </summary>
public class SignInAttempt
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public Guid? OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool Succeeded { get; set; }
    public string? FailureReason { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime OccurredAtUtc { get; set; }
}

public static class SignInFailureReasons
{
    public const string InvalidCredentials = "InvalidCredentials";
    public const string LockedOut = "LockedOut";
    public const string Inactive = "Inactive";
    public const string InvalidTwoFactorCode = "InvalidTwoFactorCode";
}
