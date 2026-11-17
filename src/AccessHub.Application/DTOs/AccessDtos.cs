namespace AccessHub.Application.DTOs;

public record AccessRequestDto(
    Guid Id,
    Guid RequesterUserId,
    string RequesterName,
    string RequesterEmail,
    Guid RoleId,
    string RoleName,
    string? Permission,
    string Reason,
    string Status,
    DateTime CreatedAtUtc,
    string? DecidedByName,
    DateTime? DecidedAtUtc,
    string? DecisionNote,
    DateTime? GrantExpiresAtUtc);

public record CreateAccessRequestRequest(Guid RoleId, string? Permission, string Reason);

public record ApproveAccessRequestRequest(DateTime? ExpiresAtUtc, string? Note);

public record RejectAccessRequestRequest(string? Note);

public record RoleOptionDto(Guid Id, string Name, string? Description, IReadOnlyList<string> PermissionCodes);

public record GrantingRoleDto(Guid RoleId, string RoleName, DateTime? ExpiresAtUtc);

/// <summary>The access checker's answer: is the permission granted, and by which roles.</summary>
public record AccessCheckDto(
    Guid UserId,
    string UserName,
    string Permission,
    bool Allowed,
    bool ViaSuperAdmin,
    IReadOnlyList<GrantingRoleDto> GrantedBy,
    IReadOnlyList<string> EffectivePermissions);
