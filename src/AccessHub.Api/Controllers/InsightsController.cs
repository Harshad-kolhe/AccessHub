using AccessHub.Api.Services;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Controllers;

/// <summary>
/// Everything the dashboard shows, in one call. Each count and chart needs the permission that guards the
/// underlying data, so a viewer sees fewer cards than an admin instead of an error.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InsightsController(IAccessHubDbContext db, CurrentUserService currentUser, TimeProvider clock) : ControllerBase
{
    /// <summary>How each audit action counts on the activity chart; anything not listed is a plain change.</summary>
    private static readonly Dictionary<string, string> ActionKinds = new()
    {
        ["Granted"] = "granted",
        ["Approved"] = "granted",
        ["Revoked"] = "revoked",
        ["Expired"] = "revoked",
        ["Deleted"] = "revoked",
        ["PasswordReset"] = "security",
        ["EnabledTwoFactor"] = "security",
        ["DisabledTwoFactor"] = "security",
        ["SignedOutEverywhere"] = "security",
    };

    /// <param name="days">Length of the charts, 7 to 90 days ending today (UTC).</param>
    /// <param name="organizationId">Super admins only: narrow the platform view to one organization.</param>
    [HttpGet]
    public async Task<ActionResult<InsightsDto>> Get([FromQuery] int days = 14, [FromQuery] Guid? organizationId = null, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 7, 90);
        var now = clock.GetUtcNow().UtcDateTime;
        var since = now.Date.AddDays(-(days - 1));
        var dayAgo = now.AddHours(-24);
        var orgId = currentUser.IsSuperAdmin ? organizationId : currentUser.OrganizationId;
        if (!currentUser.IsSuperAdmin && orgId is null)
            return Forbid();

        var canReadUsers = currentUser.HasPermission(PermissionCodes.UsersRead);
        var canReadRoles = currentUser.HasPermission(PermissionCodes.RolesRead);
        var canReadAudit = currentUser.HasPermission(PermissionCodes.AuditRead);

        // Users have no tenant query filter (sign-in must find them first), so they are scoped here.
        var users = db.Users.AsNoTracking();
        if (orgId.HasValue)
            users = users.Where(u => u.OrganizationId == orgId);

        // The other sets are tenant-filtered already; a super admin may narrow them to one organization.
        var roles = db.OrgRoles.AsNoTracking();
        var invoices = db.Invoices.AsNoTracking();
        var requests = db.AccessRequests.AsNoTracking();
        var attempts = db.SignInAttempts.AsNoTracking();
        var events = db.AuditEvents.AsNoTracking();
        var assignments = db.OrgUserRoles.AsNoTracking();
        if (currentUser.IsSuperAdmin && orgId.HasValue)
        {
            roles = roles.Where(r => r.OrganizationId == orgId);
            invoices = invoices.Where(i => i.OrganizationId == orgId);
            requests = requests.Where(r => r.OrganizationId == orgId);
            attempts = attempts.Where(a => a.OrganizationId == orgId);
            events = events.Where(a => a.OrganizationId == orgId);
            assignments = assignments.Where(ur => ur.Role.OrganizationId == orgId);
        }

        int? signIns24h = null, failed24h = null;
        if (canReadAudit)
        {
            var recent = await attempts.Where(a => a.OccurredAtUtc >= dayAgo)
                .GroupBy(a => a.Succeeded)
                .Select(g => new { Succeeded = g.Key, Count = g.Count() })
                .ToListAsync(ct);
            signIns24h = recent.Where(r => r.Succeeded).Sum(r => r.Count);
            failed24h = recent.Where(r => !r.Succeeded).Sum(r => r.Count);
        }

        var counts = new InsightCountsDto(
            Users: canReadUsers ? await users.CountAsync(ct) : null,
            ActiveUsers: canReadUsers ? await users.CountAsync(u => u.IsActive, ct) : null,
            UsersWithTwoFactor: canReadUsers ? await users.CountAsync(u => u.TwoFactorEnabled, ct) : null,
            Roles: canReadRoles ? await roles.CountAsync(ct) : null,
            Invoices: currentUser.HasPermission(PermissionCodes.InvoicesRead) ? await invoices.CountAsync(ct) : null,
            PendingAccessRequests: currentUser.HasPermission(PermissionCodes.UsersWrite)
                ? await requests.CountAsync(r => r.Status == Domain.Entities.AccessRequestStatus.Pending, ct)
                : null,
            SignIns24h: signIns24h,
            FailedSignIns24h: failed24h);

        IReadOnlyList<SignInDayDto>? signInsPerDay = null;
        IReadOnlyList<ChangesDayDto>? changesPerDay = null;
        if (canReadAudit)
        {
            var signIns = await attempts.Where(a => a.OccurredAtUtc >= since)
                .GroupBy(a => a.OccurredAtUtc.Date)
                .Select(g => new { Day = g.Key, Succeeded = g.Count(a => a.Succeeded), Failed = g.Count(a => !a.Succeeded) })
                .ToDictionaryAsync(d => DateOnly.FromDateTime(d.Day), ct);
            signInsPerDay = EachDay(since, days)
                .Select(day => signIns.TryGetValue(day, out var d) ? new SignInDayDto(day, d.Succeeded, d.Failed) : new SignInDayDto(day, 0, 0))
                .ToList();

            // Grouped by day and action in SQL (a small result), then sorted into kinds here.
            var actions = await events.Where(a => a.CreatedAtUtc >= since)
                .GroupBy(a => new { a.CreatedAtUtc.Date, a.Action })
                .Select(g => new { g.Key.Date, g.Key.Action, Count = g.Count() })
                .ToListAsync(ct);
            var byDay = actions.ToLookup(a => DateOnly.FromDateTime(a.Date));
            changesPerDay = EachDay(since, days)
                .Select(day =>
                {
                    int Count(string kind) => byDay[day].Where(a => ActionKinds.GetValueOrDefault(a.Action, "changed") == kind).Sum(a => a.Count);
                    return new ChangesDayDto(day, Count("granted"), Count("revoked"), Count("changed"), Count("security"));
                })
                .ToList();
        }

        IReadOnlyList<RoleUsageDto>? usersPerRole = null;
        if (canReadRoles)
        {
            var platformWide = orgId is null;
            usersPerRole = await roles
                .Select(r => new
                {
                    r.Id,
                    r.Name,
                    Organization = platformWide ? r.Organization.Name : null,
                    Users = r.UserRoles.Count(ur => ur.ExpiresAtUtc == null || ur.ExpiresAtUtc > now),
                })
                .OrderByDescending(r => r.Users)
                .ThenBy(r => r.Name)
                .Take(8)
                .Select(r => new RoleUsageDto(r.Id, r.Name, r.Organization, r.Users))
                .ToListAsync(ct);
        }

        IReadOnlyList<ExpiringGrantDto>? expiringSoon = null;
        if (canReadUsers && canReadRoles)
        {
            var horizon = now.AddDays(14);
            expiringSoon = await assignments
                .Where(ur => ur.ExpiresAtUtc > now && ur.ExpiresAtUtc <= horizon)
                .OrderBy(ur => ur.ExpiresAtUtc)
                .Take(5)
                .Select(ur => new ExpiringGrantDto(ur.UserId, ur.User.FullName, ur.RoleId, ur.Role.Name, ur.ExpiresAtUtc!.Value))
                .ToListAsync(ct);
        }

        return new InsightsDto(days, counts, signInsPerDay, changesPerDay, usersPerRole, expiringSoon);
    }

    private static IEnumerable<DateOnly> EachDay(DateTime since, int days) =>
        Enumerable.Range(0, days).Select(offset => DateOnly.FromDateTime(since.AddDays(offset)));
}
