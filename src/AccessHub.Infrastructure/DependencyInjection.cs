using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Email;
using AccessHub.Infrastructure.Identity;
using AccessHub.Infrastructure.Jobs;
using AccessHub.Infrastructure.Persistence;
using AccessHub.Infrastructure.Seed;
using AccessHub.Infrastructure.Services;
using Hangfire;
using Hangfire.SqlServer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AccessHub.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is not configured. " +
                "Copy .env.example to .env and set ConnectionStrings__DefaultConnection.");

        services.AddSingleton(TimeProvider.System);
        services.AddMemoryCache();

        // Retries transient failures, which Azure SQL produces from time to time.
        services.AddDbContext<AccessHubDbContext>(options =>
            options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure()));

        services.AddScoped<IAccessHubDbContext>(sp => sp.GetRequiredService<AccessHubDbContext>());
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<ISessionService, SessionService>();
        services.AddScoped<IAccessTokenValidator, AccessTokenValidator>();

        // AddIdentityCore rather than AddIdentity: this is a token-based API. AddIdentity also registers
        // cookie authentication and makes it the default scheme, so JWT requests would be redirected to
        // /Account/Login (302) instead of being authenticated by the bearer handler.
        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequiredLength = 8;
                options.User.RequireUniqueEmail = true;

                // Five wrong passwords (or two-factor codes) lock the account for 15 minutes.
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AccessHubDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddTokenProvider<InvitationTokenProvider>(InvitationTokenProvider.ProviderName);

        // Password-reset links expire after 2 hours; invitations get their own, longer lifetime.
        services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromHours(2));
        services.Configure<InvitationTokenProviderOptions>(options =>
            options.TokenLifespan = TimeSpan.FromDays(configuration.GetValue("Auth:InvitationDays", 3)));

        // Keys in the database: invitation and reset links keep working across restarts, containers and instances.
        services.AddDataProtection().SetApplicationName("AccessHub").PersistKeysToDbContext<AccessHubDbContext>();

        AddEmail(services, configuration);
        AddBackgroundJobs(services, configuration, connectionString);

        services.AddHealthChecks().AddDbContextCheck<AccessHubDbContext>("database", tags: ["ready"]);

        return services;
    }

    private static void AddEmail(IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Email");
        services.Configure<EmailOptions>(section);

        if ((section.Get<EmailOptions>() ?? new EmailOptions()).SmtpConfigured)
            services.AddSingleton<IEmailSender, SmtpEmailSender>();
        else
            services.AddSingleton<IEmailSender, LoggingEmailSender>();
    }

    private static void AddBackgroundJobs(IServiceCollection services, IConfiguration configuration, string connectionString)
    {
        services.AddScoped<ExpiredRoleAssignmentsJob>();
        services.AddScoped<SessionCleanupJob>();
        services.AddScoped<DemoResetJob>();

        if (!HangfireEnabled(configuration))
        {
            services.AddSingleton<IEmailQueue, InlineEmailQueue>();
            return;
        }

        services.AddHangfire(config => config
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(() => new SqlConnection(connectionString), new SqlServerStorageOptions
            {
                SchemaName = "hangfire",
                PrepareSchemaIfNecessary = true,
            }));
        services.AddHangfireServer(options => options.WorkerCount = 2);
        services.AddSingleton<IEmailQueue, HangfireEmailQueue>();
    }

    public static bool HangfireEnabled(IConfiguration configuration) => configuration.GetValue("Hangfire:Enabled", true);

    /// <summary>Registers the recurring jobs. Call after the database exists (after migrations).</summary>
    public static void ScheduleRecurringJobs(this IServiceProvider services)
    {
        var recurringJobs = services.GetRequiredService<IRecurringJobManager>();
        var utc = new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc };
        recurringJobs.AddOrUpdate<ExpiredRoleAssignmentsJob>("expire-temporary-roles", job => job.RunAsync(CancellationToken.None), Cron.Minutely(), utc);
        recurringJobs.AddOrUpdate<SessionCleanupJob>("clean-up-sessions", job => job.RunAsync(CancellationToken.None), Cron.Daily(3), utc);

        // A public demo starts every day fresh, whatever visitors did the day before.
        if (DemoAccounts.Enabled(services.GetRequiredService<IConfiguration>()))
            recurringJobs.AddOrUpdate<DemoResetJob>("reset-demo", job => job.RunAsync(CancellationToken.None), Cron.Daily(4), utc);
        else
            recurringJobs.RemoveIfExists("reset-demo");
    }
}
