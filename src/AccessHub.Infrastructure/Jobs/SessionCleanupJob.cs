using AccessHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AccessHub.Infrastructure.Jobs;

/// <summary>Runs nightly: deletes refresh tokens that expired or were revoked more than a week ago.</summary>
public class SessionCleanupJob(AccessHubDbContext db, TimeProvider clock, ILogger<SessionCleanupJob> logger)
{
    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = clock.GetUtcNow().UtcDateTime.AddDays(-7);
        var deleted = await db.RefreshTokens
            .Where(t => t.ExpiresAtUtc < cutoff || (t.RevokedAtUtc != null && t.RevokedAtUtc < cutoff))
            .ExecuteDeleteAsync(cancellationToken);
        if (deleted > 0)
            logger.LogInformation("Deleted {Count} old refresh token(s)", deleted);
    }
}
