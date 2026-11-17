using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace AccessHub.Infrastructure.Persistence;

public class AccessHubDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IAccessHubDbContext, IDataProtectionKeyContext
{
    /// <summary>Name of the multi-tenant query filter; code that legitimately crosses tenants ignores it by name.</summary>
    public const string TenantFilter = QueryFilters.Tenant;

    private readonly ICurrentTenant? _tenant;
    private readonly IRealtimeNotifier? _notifier;
    private readonly ILogger<AccessHubDbContext> _logger;

    // The tenant and notifier are optional so design-time tooling and unit tests can create the context directly.
    public AccessHubDbContext(
        DbContextOptions<AccessHubDbContext> options,
        ICurrentTenant? tenant = null,
        IRealtimeNotifier? notifier = null,
        ILogger<AccessHubDbContext>? logger = null) : base(options)
    {
        _tenant = tenant;
        _notifier = notifier;
        _logger = logger ?? NullLogger<AccessHubDbContext>.Instance;
    }

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Role> OrgRoles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserRole> OrgUserRoles => Set<UserRole>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<SignInAttempt> SignInAttempts => Set<SignInAttempt>();
    public DbSet<AccessRequest> AccessRequests => Set<AccessRequest>();
    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    // Read by the query filters at query time (EF parameterizes members of the context instance).
    // Without a tenant service (design time, unit tests) nothing is filtered; in the API an anonymous
    // request has no organization and is not a super admin, so the filters match nothing (fail closed).
    private bool SeesAllTenants => _tenant is null || _tenant.IsSuperAdmin;
    private Guid? CurrentOrganizationId => _tenant?.OrganizationId;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>().ToTable("Users");
        builder.Entity<IdentityRole<Guid>>().ToTable("IdentityRoles");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("UserLogins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("UserTokens");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("RoleClaims");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("IdentityUserRoles");

        builder.ApplyConfigurationsFromAssembly(typeof(AccessHubDbContext).Assembly);

        // Multi-tenant safety net. Users are deliberately not filtered: sign-in must find them before any
        // tenant is known, and every user query is already scoped explicitly.
        builder.Entity<Role>().HasQueryFilter(TenantFilter, r => SeesAllTenants || r.OrganizationId == CurrentOrganizationId);
        builder.Entity<UserRole>().HasQueryFilter(TenantFilter, ur => SeesAllTenants || ur.Role.OrganizationId == CurrentOrganizationId);
        builder.Entity<RolePermission>().HasQueryFilter(TenantFilter, rp => SeesAllTenants || rp.Role.OrganizationId == CurrentOrganizationId);
        builder.Entity<Invoice>().HasQueryFilter(TenantFilter, i => SeesAllTenants || i.OrganizationId == CurrentOrganizationId);
        builder.Entity<AuditEvent>().HasQueryFilter(TenantFilter, a => SeesAllTenants || a.OrganizationId == CurrentOrganizationId);
        builder.Entity<AccessRequest>().HasQueryFilter(TenantFilter, r => SeesAllTenants || r.OrganizationId == CurrentOrganizationId);
        builder.Entity<SignInAttempt>().HasQueryFilter(TenantFilter, a => SeesAllTenants || a.OrganizationId == CurrentOrganizationId);
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        var newAuditEvents = ChangeTracker.Entries<AuditEvent>()
            .Where(entry => entry.State == EntityState.Added)
            .Select(entry => entry.Entity)
            .ToList();

        var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);

        if (newAuditEvents.Count > 0 && _notifier is not null)
        {
            try
            {
                await _notifier.AuditEventsRecordedAsync(newAuditEvents, cancellationToken);
            }
            catch (Exception ex)
            {
                // Live updates are best effort; the change itself is already saved.
                _logger.LogWarning(ex, "Could not publish {Count} audit event(s) to connected clients", newAuditEvents.Count);
            }
        }

        return result;
    }
}
