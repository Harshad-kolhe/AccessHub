using AccessHub.Application.Interfaces;
using AccessHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AccessHub.Infrastructure.Jobs;

/// <summary>
/// Runs every minute (Hangfire): removes temporary role assignments that have expired, audits each removal and
/// tells the affected users' consoles. Permissions stop being granted at expiry even before this runs, because
/// permission resolution already ignores expired assignments.
/// </summary>
public class ExpiredRoleAssignmentsJob(
    AccessHubDbContext db,
    IAuditService audit,
    ISessionService sessions,
    IRealtimeNotifier notifier,
    TimeProvider clock,
    ILogger<ExpiredRoleAssignmentsJob> logger)
{
    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;

        // A background job has no tenant; it works across organizations on purpose.
        var expired = await db.OrgUserRoles.IgnoreQueryFilters(QueryFilters.TenantOnly)
            .Include(ur => ur.Role)
            .Include(ur => ur.User)
            .Where(ur => ur.ExpiresAtUtc != null && ur.ExpiresAtUtc <= now)
            .ToListAsync(cancellationToken);
        if (expired.Count == 0)
            return;

        db.OrgUserRoles.RemoveRange(expired);
        foreach (var assignment in expired)
        {
            audit.Record(AuditActors.System, assignment.Role.OrganizationId, "Expired", "RoleAssignment", assignment.UserId.ToString(), new
            {
                Name = $"{assignment.User.FullName}: {assignment.Role.Name}",
                User = assignment.User.FullName,
                Role = assignment.Role.Name,
                assignment.ExpiresAtUtc,
            });
        }
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Removed {Count} expired temporary role assignment(s)", expired.Count);

        foreach (var userId in expired.Select(ur => ur.UserId).Distinct())
        {
            await sessions.InvalidateAccessTokensAsync(userId, cancellationToken);
            await notifier.PermissionsChangedAsync(userId, "A temporary role expired.", cancellationToken);
        }
    }
}
