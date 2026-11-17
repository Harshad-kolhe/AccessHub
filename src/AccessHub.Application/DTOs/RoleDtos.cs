namespace AccessHub.Application.DTOs;

public record RoleDto(
    Guid Id,
    Guid OrganizationId,
    string Name,
    string? Description,
    IReadOnlyList<string> PermissionCodes,
    int UserCount);

public record CreateRoleRequest(string Name, string? Description, IReadOnlyList<string> PermissionCodes);

public record UpdateRoleRequest(string Name, string? Description, IReadOnlyList<string> PermissionCodes);

public record PermissionDto(Guid Id, string Code, string DisplayName, string? Description);

public record RealtimeTicketDto(string Ticket, DateTime ExpiresAtUtc, string HubPath);
