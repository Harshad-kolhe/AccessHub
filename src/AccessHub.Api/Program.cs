using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using AccessHub.Api.Extensions;
using AccessHub.Api.OpenApi;
using AccessHub.Api.Realtime;
using AccessHub.Api.Services;
using AccessHub.Api.Validation;
using AccessHub.Application;
using AccessHub.Application.Interfaces;
using AccessHub.Infrastructure;
using AccessHub.Infrastructure.Seed;
using AccessHub.Infrastructure.Services;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

// Secrets (connection string, JWT signing key, SMTP and OAuth credentials) are not kept in appsettings.json.
// For local development they come from a git-ignored .env file at the repo root (see .env.example); in any
// other environment set them as real environment variables, which always take precedence over the file.
DotNetEnv.Env.NoClobber().TraversePath().Load();

// Logs startup failures until the configured logger takes over. A plain (not "bootstrap") logger, so test
// hosts can start the app many times in one process.
Log.Logger = new LoggerConfiguration().WriteTo.Console(formatProvider: CultureInfo.InvariantCulture).CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    var configuration = builder.Configuration;

    builder.Services.AddSerilog((services, logger) => logger
        .ReadFrom.Configuration(configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    builder.Services.AddControllers(options => options.Filters.Add<FluentValidationFilter>());
    builder.Services.AddOpenApi(options =>
    {
        options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info.Title = "AccessHub API";
            return Task.CompletedTask;
        });
        options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
        options.AddOperationTransformer<BearerSecuritySchemeTransformer>();
    });

    // Every error is an RFC 9457 problem: unhandled exceptions (no internals leaked), empty 401/403/404
    // responses, validation failures and rate-limit rejections all share one shape.
    builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
    builder.Services.AddExceptionHandler<DuplicateKeyExceptionHandler>();

    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(configuration);
    builder.Services.AddPermissionPolicies();
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<CurrentUserService>();
    builder.Services.AddScoped<ICurrentTenant>(sp => sp.GetRequiredService<CurrentUserService>());

    builder.Services.AddSignalR();
    builder.Services.AddSingleton<IRealtimeNotifier, SignalRNotifier>();

    AddAuthentication(builder.Services, configuration);
    AddRateLimiting(builder.Services, configuration);

    // The browser calls this API for one thing only: the realtime hub (with a short-lived ticket). Everything
    // else goes through the Next.js server, server-to-server, so CORS is limited to the hub.
    var webOrigins = configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"];
    builder.Services.AddCors(options => options.AddPolicy(RealtimeCors, policy => policy
        .WithOrigins(webOrigins)
        .AllowAnyHeader()
        .WithMethods("GET", "POST")));

    // The Next.js server forwards the browser's address in X-Forwarded-For. Trust it only from known proxies:
    // loopback by default, plus the networks listed in ForwardedHeaders:TrustedNetworks (a Docker network).
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        foreach (var network in configuration.GetSection("ForwardedHeaders:TrustedNetworks").Get<string[]>() ?? [])
            options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
    });

    var app = builder.Build();

    app.UseForwardedHeaders();
    app.UseSerilogRequestLogging(options =>
    {
        options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0} ms";
        // Health probes run every few seconds; keep them out of the log unless they fail.
        options.GetLevel = (http, _, exception) =>
            exception is not null || http.Response.StatusCode >= 500 ? LogEventLevel.Error
            : http.Request.Path.StartsWithSegments("/health") ? LogEventLevel.Verbose
            : LogEventLevel.Information;
        options.EnrichDiagnosticContext = (diagnostics, http) =>
        {
            var userId = http.User.FindFirstValue(AccessHubClaims.Subject);
            if (userId is not null)
                diagnostics.Set("UserId", userId);
        };
    });
    app.UseExceptionHandler();
    app.UseStatusCodePages();

    // API reference: always in development; elsewhere only when OpenApi:Enabled is set (the public demo).
    if (app.Environment.IsDevelopment() || configuration.GetValue("OpenApi:Enabled", false))
    {
        app.MapOpenApi();                                                        // /openapi/v1.json
        app.MapScalarApiReference(options => options.WithTitle("AccessHub API")); // /scalar
    }

    app.UseCors();
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapHub<NotificationsHub>(NotificationsHub.Path).RequireCors(RealtimeCors);

    // Liveness: the process answers. Readiness: it can also reach the database (used by Docker and Azure).
    app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });
    app.MapHealthChecks("/health/ready", new HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = (http, report) => http.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            durationMs = Math.Round(report.TotalDuration.TotalMilliseconds),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                durationMs = Math.Round(entry.Value.Duration.TotalMilliseconds),
            }),
        }),
    });

    await DataSeeder.SeedAsync(app.Services);

    if (AccessHub.Infrastructure.DependencyInjection.HangfireEnabled(configuration))
    {
        app.Services.ScheduleRecurringJobs();
        if (app.Environment.IsDevelopment())
            app.MapHangfireDashboard("/hangfire"); // local requests only (Hangfire's default authorization)
    }

    await app.RunAsync();
    return 0;
}
catch (Exception exception) when (exception is not HostAbortedException)
{
    // HostAbortedException is how test hosts (WebApplicationFactory) stop the app after building it.
    Log.Fatal(exception, "The AccessHub API failed to start or stopped unexpectedly");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}

static void AddAuthentication(IServiceCollection services, IConfiguration configuration)
{
    var jwtKey = configuration["Jwt:Key"];
    if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
        throw new InvalidOperationException(
            "Jwt:Key must be at least 32 characters (HS256 needs a 256-bit key). Copy .env.example to .env and set Jwt__Key.");

    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
    var issuer = configuration["Jwt:Issuer"] ?? "AccessHub";

    var authentication = services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        // Access tokens for the console (sent by the Next.js server).
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = issuer,
                ValidAudience = configuration["Jwt:Audience"] ?? "AccessHub.Web",
                IssuerSigningKey = signingKey,
                ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = AccessHubClaims.Name,
            };
            options.Events = new JwtBearerEvents
            {
                // A signature check alone would accept a token until it expires. This also rejects it once the user's
                // security stamp changes (roles changed, password reset, "sign out everywhere") or they are deactivated.
                OnTokenValidated = async context =>
                {
                    var principal = context.Principal!;
                    var validator = context.HttpContext.RequestServices.GetRequiredService<IAccessTokenValidator>();
                    var isCurrent = Guid.TryParse(principal.FindFirstValue(AccessHubClaims.Subject), out var userId)
                        && await validator.IsCurrentAsync(userId, principal.FindFirstValue(AccessHubClaims.StampFingerprint), context.HttpContext.RequestAborted);
                    if (!isCurrent)
                        context.Fail("The access token was revoked.");
                },
            };
        })
        // Realtime tickets, accepted by the SignalR hub only (their own audience; see RealtimeController).
        .AddJwtBearer(RealtimeTicket.Scheme, options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = issuer,
                ValidAudience = TokenService.RealtimeAudience,
                IssuerSigningKey = signingKey,
                ClockSkew = TimeSpan.FromSeconds(30),
            };
            options.Events = new JwtBearerEvents
            {
                // WebSockets cannot send an Authorization header, so SignalR puts the ticket in the query string.
                OnMessageReceived = context =>
                {
                    var ticket = context.Request.Query["access_token"].ToString();
                    if (ticket.Length > 0 && context.HttpContext.Request.Path.StartsWithSegments(NotificationsHub.Path))
                        context.Token = ticket;
                    return Task.CompletedTask;
                },
            };
        })
        // Holds the result of a Google/Microsoft sign-in for the few seconds until the callback reads it.
        .AddCookie(IdentityConstants.ExternalScheme, options =>
        {
            options.Cookie.Name = "accesshub.external";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.ExpireTimeSpan = TimeSpan.FromMinutes(10);
        });

    // External providers appear only when their credentials are configured (see .env.example).
    var google = configuration.GetSection("Authentication:Google");
    if (!string.IsNullOrWhiteSpace(google["ClientId"]) && !string.IsNullOrWhiteSpace(google["ClientSecret"]))
        authentication.AddGoogle("Google", "Google", options =>
        {
            options.ClientId = google["ClientId"]!;
            options.ClientSecret = google["ClientSecret"]!;
            options.SignInScheme = IdentityConstants.ExternalScheme;
        });

    var microsoft = configuration.GetSection("Authentication:Microsoft");
    if (!string.IsNullOrWhiteSpace(microsoft["ClientId"]) && !string.IsNullOrWhiteSpace(microsoft["ClientSecret"]))
        authentication.AddMicrosoftAccount("Microsoft", "Microsoft", options =>
        {
            options.ClientId = microsoft["ClientId"]!;
            options.ClientSecret = microsoft["ClientSecret"]!;
            options.SignInScheme = IdentityConstants.ExternalScheme;
        });
}

static void AddRateLimiting(IServiceCollection services, IConfiguration configuration)
{
    var authPermits = configuration.GetValue("RateLimiting:AuthPermitPerMinute", 20);
    var refreshPermits = configuration.GetValue("RateLimiting:RefreshPermitPerMinute", 120);

    services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.OnRejected = async (context, cancellationToken) =>
        {
            if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);

            var problems = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
            await problems.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context.HttpContext,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Too many attempts",
                    Detail = "Too many requests from your address. Wait a minute, then try again.",
                },
            });
        };

        // Partitioned by client address (the browser's, via X-Forwarded-For from the Next.js server).
        options.AddPolicy(RateLimitPolicies.Auth, http => RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = authPermits, Window = TimeSpan.FromMinutes(1) }));
        options.AddPolicy(RateLimitPolicies.Refresh, http => RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = refreshPermits, Window = TimeSpan.FromMinutes(1) }));
    });
}

public partial class Program
{
    private const string RealtimeCors = "realtime";
}
