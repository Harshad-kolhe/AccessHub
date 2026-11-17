using AccessHub.Api.Extensions;
using AccessHub.Api.Services;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RolesController(
    IAccessHubDbContext db,
    IAuditService audit,
    ISessionService sessions,
    IRealtimeNotifier notifier,
    CurrentUserService currentUser,
    TimeProvider clock) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionCodes.RolesRead)]
    public async Task<ActionResult<IEnumerable<RoleDto>>> GetAll([FromQuery] Guid organizationId, CancellationToken ct)
    {
        if (!CanAccess(organizationId))
            return Forbid();

        return Ok(await Project(db.OrgRoles.Where(r => r.OrganizationId == organizationId)).ToListAsync(ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionCodes.RolesRead)]
    public async Task<ActionResult<RoleDto>> GetById(Guid id, CancellationToken ct)
    {
        var role = await Project(db.OrgRoles.Where(r => r.Id == id)).FirstOrDefaultAsync(ct);
        if (role is null)
            return NotFound();
        return CanAccess(role.OrganizationId) ? Ok(role) : Forbid();
    }

    [HttpPost]
    [Authorize(Policy = PermissionCodes.RolesWrite)]
    public async Task<ActionResult<RoleDto>> Create([FromQuery] Guid organizationId, [FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        if (!CanAccess(organizationId))
            return Forbid();
        if (await NameTakenAsync(organizationId, request.Name, exceptRoleId: null, ct))
            return NameInUse(request.Name);
        var missing = currentUser.MissingPermissions(request.PermissionCodes);
        if (missing.Count > 0)
            return this.CannotDelegate(request.Name, missing);

        var role = new Role
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            Name = request.Name,
            Description = request.Description,
            CreatedAtUtc = clock.GetUtcNow().UtcDateTime,
        };
        db.OrgRoles.Add(role);
        await SetPermissionsAsync(role.Id, request.PermissionCodes, ct);
        audit.Record(currentUser.UserId, organizationId, "Created", "Role", role.Id.ToString(), new { role.Name, request.PermissionCodes });
        await db.SaveChangesAsync(ct);

        var dto = await Project(db.OrgRoles.Where(r => r.Id == role.Id)).FirstAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = role.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionCodes.RolesWrite)]
    public async Task<ActionResult<RoleDto>> Update(Guid id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        var role = await db.OrgRoles
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
            return NotFound();
        if (!CanAccess(role.OrganizationId))
            return Forbid();
        if (await NameTakenAsync(role.OrganizationId, request.Name, exceptRoleId: role.Id, ct))
            return NameInUse(request.Name);

        var before = new { role.Name, role.Description, PermissionCodes = role.RolePermissions.Select(rp => rp.Permission.Code).OrderBy(c => c).ToList() };
        // Adding (or removing) a permission is only allowed for permissions the editor holds.
        var changed = before.PermissionCodes.Except(request.PermissionCodes).Union(request.PermissionCodes.Except(before.PermissionCodes));
        var missing = currentUser.MissingPermissions(changed);
        if (missing.Count > 0)
            return this.CannotDelegate(role.Name, missing);
        if (await SelfLockoutAsync(role, before.PermissionCodes.Except(request.PermissionCodes), ct) is { } lockout)
            return lockout;

        role.Name = request.Name;
        role.Description = request.Description;
        db.RolePermissions.RemoveRange(role.RolePermissions);
        await SetPermissionsAsync(role.Id, request.PermissionCodes, ct);

        audit.Record(currentUser.UserId, role.OrganizationId, "Updated", "Role", role.Id.ToString(), new
        {
            Before = before,
            After = new { role.Name, role.Description, PermissionCodes = request.PermissionCodes.OrderBy(c => c).ToList() },
        });
        await db.SaveChangesAsync(ct);

        await NotifyHoldersAsync(role.Id, $"The {role.Name} role changed.", ct);
        return Ok(await Project(db.OrgRoles.Where(r => r.Id == role.Id)).FirstAsync(ct));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionCodes.RolesWrite)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var role = await db.OrgRoles
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (role is null)
            return NotFound();
        if (!CanAccess(role.OrganizationId))
            return Forbid();
        var missing = currentUser.MissingPermissions(role.RolePermissions.Select(rp => rp.Permission.Code));
        if (missing.Count > 0)
            return this.CannotDelegate(role.Name, missing);
        if (await SelfLockoutAsync(role, role.RolePermissions.Select(rp => rp.Permission.Code), ct) is { } lockout)
            return lockout;

        var holders = await db.OrgUserRoles.Where(ur => ur.RoleId == id).Select(ur => ur.UserId).ToListAsync(ct);

        db.OrgRoles.Remove(role);
        audit.Record(currentUser.UserId, role.OrganizationId, "Deleted", "Role", role.Id.ToString(), new
        {
            role.Name,
            PermissionCodes = role.RolePermissions.Select(rp => rp.Permission.Code).ToList(),
            HeldBy = holders.Count,
        });
        await db.SaveChangesAsync(ct);

        foreach (var userId in holders)
        {
            await sessions.InvalidateAccessTokensAsync(userId, ct);
            await notifier.PermissionsChangedAsync(userId, $"The {role.Name} role was deleted.", ct);
        }
        return NoContent();
    }

    private static IQueryable<RoleDto> Project(IQueryable<Role> roles) =>
        roles.AsNoTracking()
            .OrderBy(r => r.Name)
            .Select(r => new RoleDto(
                r.Id,
                r.OrganizationId,
                r.Name,
                r.Description,
                r.RolePermissions.Select(rp => rp.Permission.Code).ToList(),
                r.UserRoles.Count));

    private async Task SetPermissionsAsync(Guid roleId, IReadOnlyList<string> permissionCodes, CancellationToken ct)
    {
        // Validation has already rejected unknown and platform-only codes.
        var permissions = await db.Permissions.Where(p => permissionCodes.Contains(p.Code)).ToListAsync(ct);
        foreach (var permission in permissions)
            db.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permission.Id });
    }

    private async Task NotifyHoldersAsync(Guid roleId, string reason, CancellationToken ct)
    {
        var holders = await db.OrgUserRoles.Where(ur => ur.RoleId == roleId).Select(ur => ur.UserId).ToListAsync(ct);
        foreach (var userId in holders)
        {
            await sessions.InvalidateAccessTokensAsync(userId, ct);
            await notifier.PermissionsChangedAsync(userId, reason, ct);
        }
    }

    /// <summary>
    /// Stops editors from taking permissions away from themselves: removing a permission from (or deleting) a role
    /// they hold is refused when no other role of theirs grants it. Another admin can still make the change.
    /// </summary>
    private async Task<ObjectResult?> SelfLockoutAsync(Role role, IEnumerable<string> removedCodes, CancellationToken ct)
    {
        var removed = removedCodes.ToList();
        if (currentUser.IsSuperAdmin || removed.Count == 0)
            return null;

        var now = clock.GetUtcNow().UtcDateTime;
        if (!await db.OrgUserRoles.AnyAsync(ur => ur.UserId == currentUser.UserId && ur.RoleId == role.Id, ct))
            return null;

        var keptElsewhere = await db.OrgUserRoles
            .Where(ur => ur.UserId == currentUser.UserId && ur.RoleId != role.Id && (ur.ExpiresAtUtc == null || ur.ExpiresAtUtc > now))
            .SelectMany(ur => ur.Role.RolePermissions.Select(rp => rp.Permission.Code))
            .ToListAsync(ct);
        var lost = removed.Except(keptElsewhere).Order().ToList();
        return lost.Count == 0
            ? null
            : Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "You'd lose this access yourself",
                detail: $"You hold {role.Name}, and this change would take {string.Join(", ", lost)} away from you too. Ask another admin to make it.");
    }

    private Task<bool> NameTakenAsync(Guid organizationId, string name, Guid? exceptRoleId, CancellationToken ct) =>
        db.OrgRoles.AnyAsync(r => r.OrganizationId == organizationId && r.Name == name && r.Id != exceptRoleId, ct);

    private ObjectResult NameInUse(string name) =>
        Problem(statusCode: 409, title: "Role name in use", detail: $"This organization already has a role called {name}.");

    private bool CanAccess(Guid organizationId) =>
        currentUser.IsSuperAdmin || currentUser.OrganizationId == organizationId;
}
