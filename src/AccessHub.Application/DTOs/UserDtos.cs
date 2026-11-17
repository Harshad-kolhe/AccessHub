namespace AccessHub.Application.DTOs;

public record UserRoleDto(Guid RoleId, string RoleName, DateTime AssignedAtUtc, DateTime? ExpiresAtUtc);

public record UserDto(
    Guid Id,
    string Email,
    string FullName,
    Guid? OrganizationId,
    bool IsActive,
    bool IsSuperAdmin,
    bool IsInvited,
    bool TwoFactorEnabled,
    DateTime? LockedUntilUtc,
    DateTime? LastSignInAtUtc,
    DateTime CreatedAtUtc,
    IReadOnlyList<UserRoleDto> Roles);

public record CreateUserRequest(
    string Email,
    string Password,
    string FullName,
    Guid OrganizationId,
    IReadOnlyList<Guid>? RoleIds);

/// <summary>Creates the user without a password and emails them a link to set one.</summary>
public record InviteUserRequest(string Email, string FullName, Guid OrganizationId, IReadOnlyList<Guid>? RoleIds);

public record UpdateUserRequest(string FullName, bool IsActive);

/// <summary>Grants a role, optionally only until <see cref="ExpiresAtUtc"/> (temporary access).</summary>
public record GrantRoleRequest(Guid RoleId, DateTime? ExpiresAtUtc);
