namespace AccessHub.Application.DTOs;

/// <summary>Dashboard data. A section (or count) is null when the caller lacks the permission it needs.</summary>
public record InsightsDto(
    int Days,
    InsightCountsDto Counts,
    IReadOnlyList<SignInDayDto>? SignInsPerDay,
    IReadOnlyList<ChangesDayDto>? ChangesPerDay,
    IReadOnlyList<RoleUsageDto>? UsersPerRole,
    IReadOnlyList<ExpiringGrantDto>? ExpiringSoon);

public record InsightCountsDto(
    int? Users,
    int? ActiveUsers,
    int? UsersWithTwoFactor,
    int? Roles,
    int? Invoices,
    int? PendingAccessRequests,
    int? SignIns24h,
    int? FailedSignIns24h);

public record SignInDayDto(DateOnly Date, int Succeeded, int Failed);

/// <summary>Audit events per day, grouped by what they did to access.</summary>
public record ChangesDayDto(DateOnly Date, int Granted, int Revoked, int Changed, int Security);

/// <summary>Holders of a role right now. Organization is set in the platform-wide view, where role names repeat.</summary>
public record RoleUsageDto(Guid RoleId, string Role, string? Organization, int Users);

/// <summary>A temporary role assignment that ends soon.</summary>
public record ExpiringGrantDto(Guid UserId, string UserName, Guid RoleId, string RoleName, DateTime ExpiresAtUtc);
