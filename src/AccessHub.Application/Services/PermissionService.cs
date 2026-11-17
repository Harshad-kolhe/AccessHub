using AccessHub.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Application.Services;

public class PermissionService(IAccessHubDbContext db) : IPermissionService
{
    public async Task<IReadOnlyList<string>> GetUserPermissionsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null)
            return [];

        if (user.IsSuperAdmin)
            return await db.Permissions.AsNoTracking()
                .Select(p => p.Code)
                .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;

        // Runs at sign-in, before any tenant is known, and is already scoped to one user: skip the tenant filter.
        // Expired temporary roles grant nothing, even before the background job removes them.
        return await (
            from ur in db.OrgUserRoles.IgnoreQueryFilters(QueryFilters.TenantOnly).AsNoTracking()
            where ur.UserId == userId && (ur.ExpiresAtUtc == null || ur.ExpiresAtUtc > now)
            join rp in db.RolePermissions.IgnoreQueryFilters(QueryFilters.TenantOnly).AsNoTracking() on ur.RoleId equals rp.RoleId
            join p in db.Permissions.AsNoTracking() on rp.PermissionId equals p.Id
            select p.Code).Distinct().ToListAsync(cancellationToken);
    }

    public async Task<bool> UserHasPermissionAsync(Guid userId, string permissionCode, CancellationToken cancellationToken = default)
    {
        var permissions = await GetUserPermissionsAsync(userId, cancellationToken);
        return permissions.Contains(permissionCode);
    }
}
