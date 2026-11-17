namespace AccessHub.Domain.Entities;

public class UserRole
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;
    /// <summary>Temporary access: a background job removes the assignment once this passes.</summary>
    public DateTime? ExpiresAtUtc { get; set; }
    public Guid? GrantedByUserId { get; set; }

    public ApplicationUser User { get; set; } = null!;
    public Role Role { get; set; } = null!;

    public bool IsActive(DateTime nowUtc) => ExpiresAtUtc is null || ExpiresAtUtc > nowUtc;
}
