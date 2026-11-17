namespace AccessHub.Domain.Entities;

/// <summary>A user asks for a role (optionally because a page needed one of its permissions); an admin decides.</summary>
public class AccessRequest
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid RequesterUserId { get; set; }
    public Guid RoleId { get; set; }
    public string? Permission { get; set; }
    public string Reason { get; set; } = string.Empty;
    public AccessRequestStatus Status { get; set; } = AccessRequestStatus.Pending;
    public DateTime CreatedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public string? DecisionNote { get; set; }
    /// <summary>Set when the request was approved as a temporary role.</summary>
    public DateTime? GrantExpiresAtUtc { get; set; }

    public ApplicationUser Requester { get; set; } = null!;
    public Role Role { get; set; } = null!;
    public Organization Organization { get; set; } = null!;
}

public enum AccessRequestStatus
{
    Pending,
    Approved,
    Rejected,
    Cancelled
}
