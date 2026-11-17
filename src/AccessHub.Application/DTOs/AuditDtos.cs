namespace AccessHub.Application.DTOs;

public record AuditEventDto(
    Guid Id,
    Guid? OrganizationId,
    Guid ActorUserId,
    string ActorName,
    string? ActorEmail,
    string Action,
    string EntityType,
    string? EntityId,
    string? PayloadJson,
    DateTime CreatedAtUtc);

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
