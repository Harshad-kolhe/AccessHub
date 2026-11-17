namespace AccessHub.Application.DTOs;

public record OrganizationDto(Guid Id, string Name, string Slug, bool IsActive, string? Accent, int UserCount, DateTime CreatedAtUtc);

public record CreateOrganizationRequest(string Name, string Slug, string? Accent = null);

public record UpdateOrganizationRequest(string Name, string Slug, bool IsActive, string? Accent = null);
