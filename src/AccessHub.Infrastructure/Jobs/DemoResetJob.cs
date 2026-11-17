using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Persistence;
using AccessHub.Infrastructure.Seed;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AccessHub.Infrastructure.Jobs;

/// <summary>
/// Public demo only (Demo:Enabled): every night, deletes all tenant data and seeds the demo platform again, so
/// whatever visitors changed during the day is undone. The permission catalog and data-protection keys stay.
/// </summary>
public class DemoResetJob(
    AccessHubDbContext db,
    UserManager<ApplicationUser> userManager,
    IConfiguration configuration,
    ILogger<DemoResetJob> logger)
{
    public async Task RunAsync(CancellationToken cancellationToken = default)
    {
        if (!DemoAccounts.Enabled(configuration))
            return;

        // Retries on transient errors replay the whole unit (EnableRetryOnFailure needs that for transactions).
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            // Children before parents. The tenant filters are off: this job crosses every organization on purpose.
            await db.AuditEvents.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.AccessRequests.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.SignInAttempts.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.RefreshTokens.ExecuteDeleteAsync(cancellationToken);
            await db.Invoices.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.OrgUserRoles.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.RolePermissions.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.OrgRoles.IgnoreQueryFilters().ExecuteDeleteAsync(cancellationToken);
            await db.UserLogins.ExecuteDeleteAsync(cancellationToken);
            await db.UserTokens.ExecuteDeleteAsync(cancellationToken);
            await db.UserClaims.ExecuteDeleteAsync(cancellationToken);
            await db.UserRoles.ExecuteDeleteAsync(cancellationToken);
            await db.Users.ExecuteDeleteAsync(cancellationToken);
            await db.Organizations.ExecuteDeleteAsync(cancellationToken);

            db.ChangeTracker.Clear();
            await DataSeeder.SeedDemoDataAsync(db, userManager, configuration);
            await transaction.CommitAsync(cancellationToken);
        });

        logger.LogInformation("Demo data reset");
    }
}
