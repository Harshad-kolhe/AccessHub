using AccessHub.Api.Services;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Email;
using AccessHub.Infrastructure.Identity;
using AccessHub.Infrastructure.Seed;
using AccessHub.Infrastructure.Services;
using AccessHub.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController(
    UserManager<ApplicationUser> userManager,
    IAccessHubDbContext db,
    IAuditService audit,
    ISessionService sessions,
    IRealtimeNotifier notifier,
    IEmailQueue emails,
    IConfiguration configuration,
    CurrentUserService currentUser,
    TimeProvider clock) : ControllerBase
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    [HttpGet]
    [Authorize(Policy = PermissionCodes.UsersRead)]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetAll([FromQuery] Guid? organizationId, CancellationToken ct)
    {
        var orgId = currentUser.IsSuperAdmin ? organizationId ?? currentUser.OrganizationId : currentUser.OrganizationId;
        if (orgId is null)
            return Forbid();

        return Ok(await QueryUsers(db.Users.Where(u => u.OrganizationId == orgId), ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionCodes.UsersRead)]
    public async Task<ActionResult<UserDto>> GetById(Guid id, CancellationToken ct)
    {
        var user = (await QueryUsers(db.Users.Where(u => u.Id == id), ct)).FirstOrDefault();
        if (user is null)
            return NotFound();
        return CanAccess(user.OrganizationId) ? Ok(user) : Forbid();
    }

    /// <summary>Creates a user with a password chosen by the admin. The console invites instead (see Invite).</summary>
    [HttpPost]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        if (!CanAccess(request.OrganizationId))
            return Forbid();
        if (await userManager.FindByEmailAsync(request.Email) is not null)
            return EmailInUse();
        if (await DelegationProblemAsync(request.OrganizationId, request.RoleIds, ct) is { } delegationProblem)
            return delegationProblem;

        var user = NewUser(request.Email, request.FullName, request.OrganizationId, emailConfirmed: true);
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
            return this.IdentityProblem(result);

        await AddRolesAsync(user.Id, request.OrganizationId, request.RoleIds, ct);
        audit.Record(currentUser.UserId, request.OrganizationId, "Created", "User", user.Id.ToString(), new { user.Email, user.FullName });
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, await LoadAsync(user.Id, ct));
    }

    /// <summary>Creates the account without a password and emails a link to set one.</summary>
    [HttpPost("invite")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<UserDto>> Invite([FromBody] InviteUserRequest request, CancellationToken ct)
    {
        if (!CanAccess(request.OrganizationId))
            return Forbid();
        if (await userManager.FindByEmailAsync(request.Email) is not null)
            return EmailInUse();
        if (await DelegationProblemAsync(request.OrganizationId, request.RoleIds, ct) is { } delegationProblem)
            return delegationProblem;

        var user = NewUser(request.Email, request.FullName, request.OrganizationId, emailConfirmed: false);
        var result = await userManager.CreateAsync(user);
        if (!result.Succeeded)
            return this.IdentityProblem(result);

        await AddRolesAsync(user.Id, request.OrganizationId, request.RoleIds, ct);
        audit.Record(currentUser.UserId, request.OrganizationId, "Invited", "User", user.Id.ToString(), new { user.Email, user.FullName });
        await db.SaveChangesAsync(ct);
        await SendInvitationAsync(user, ct);

        return CreatedAtAction(nameof(GetById), new { id = user.Id }, await LoadAsync(user.Id, ct));
    }

    [HttpPost("{id:guid}/resend-invite")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<IActionResult> ResendInvite(Guid id, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null || !CanAccess(user.OrganizationId))
            return NotFound();
        if (await userManager.HasPasswordAsync(user))
            return Problem(statusCode: 409, title: "Already accepted", detail: $"{user.FullName} has already set a password.");

        await SendInvitationAsync(user, ct);
        await audit.LogAsync(currentUser.UserId, user.OrganizationId, "ResentInvitation", "User", user.Id.ToString(), new { user.Email, user.FullName }, ct);
        return Accepted();
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<UserDto>> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(id.ToString());
        if (user is null)
            return NotFound();
        if (!CanAccess(user.OrganizationId))
            return Forbid();
        if (id == currentUser.UserId && !request.IsActive)
            return Problem(statusCode: 400, title: "You can't deactivate yourself", detail: "Ask another administrator to do it.");
        if (!request.IsActive && DemoAccounts.IsProtected(configuration, user.Email))
            return this.DemoAccountProtected("deactivating it");

        var before = new { user.FullName, user.IsActive };
        user.FullName = request.FullName;
        user.IsActive = request.IsActive;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return this.IdentityProblem(result);

        audit.Record(currentUser.UserId, user.OrganizationId, "Updated", "User", user.Id.ToString(),
            new { Before = before, After = new { user.FullName, user.IsActive } });
        await db.SaveChangesAsync(ct);

        if (before.IsActive && !user.IsActive)
        {
            await sessions.RevokeAllAsync(user.Id, RevokeReasons.UserDeactivated, ct);
            await notifier.PermissionsChangedAsync(user.Id, "Your account was deactivated.", ct);
        }

        return Ok(await LoadAsync(user.Id, ct));
    }

    /// <summary>Grants a role, or changes when an existing grant expires. Without an expiry the grant is permanent.</summary>
    [HttpPost("{id:guid}/roles")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<UserDto>> GrantRole(Guid id, [FromBody] GrantRoleRequest request, CancellationToken ct)
    {
        var (user, role, problem) = await LoadAssignmentTargetsAsync(id, request.RoleId, ct);
        if (problem is not null)
            return problem;

        var assignment = await db.OrgUserRoles.FirstOrDefaultAsync(ur => ur.UserId == user!.Id && ur.RoleId == role!.Id, ct);
        var isNew = assignment is null;
        if (assignment is null)
        {
            assignment = new UserRole { UserId = user!.Id, RoleId = role!.Id, AssignedAtUtc = Now, GrantedByUserId = currentUser.UserId };
            db.OrgUserRoles.Add(assignment);
        }
        assignment.ExpiresAtUtc = request.ExpiresAtUtc;

        audit.Record(currentUser.UserId, role!.OrganizationId, isNew ? "Granted" : "Updated", "RoleAssignment", user!.Id.ToString(), new
        {
            Name = $"{user.FullName}: {role.Name}",
            User = user.FullName,
            Role = role.Name,
            request.ExpiresAtUtc,
        });
        await db.SaveChangesAsync(ct);

        await PermissionsChangedAsync(user.Id, isNew ? $"You now have the {role.Name} role." : $"Your {role.Name} role changed.", ct);
        return Ok(await LoadAsync(user.Id, ct));
    }

    [HttpDelete("{id:guid}/roles/{roleId:guid}")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<UserDto>> RevokeRole(Guid id, Guid roleId, CancellationToken ct)
    {
        var (user, role, problem) = await LoadAssignmentTargetsAsync(id, roleId, ct);
        if (problem is not null)
            return problem;

        var assignment = await db.OrgUserRoles.FirstOrDefaultAsync(ur => ur.UserId == user!.Id && ur.RoleId == role!.Id, ct);
        if (assignment is null)
            return NotFound();

        db.OrgUserRoles.Remove(assignment);
        audit.Record(currentUser.UserId, role!.OrganizationId, "Revoked", "RoleAssignment", user!.Id.ToString(), new
        {
            Name = $"{user.FullName}: {role.Name}",
            User = user.FullName,
            Role = role.Name,
        });
        await db.SaveChangesAsync(ct);

        await PermissionsChangedAsync(user.Id, $"Your {role.Name} role was removed.", ct);
        return Ok(await LoadAsync(user.Id, ct));
    }

    // ----- Helpers -----

    /// <summary>One SQL query for any number of users: roles come back as a projected collection, not per user.</summary>
    private async Task<List<UserDto>> QueryUsers(IQueryable<ApplicationUser> users, CancellationToken ct)
    {
        var rows = await users.AsNoTracking()
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FullName,
                u.OrganizationId,
                u.IsActive,
                u.IsSuperAdmin,
                IsInvited = u.PasswordHash == null,
                u.TwoFactorEnabled,
                u.LockoutEnd,
                u.LastSignInAtUtc,
                u.CreatedAtUtc,
                Roles = u.UserRoles
                    .OrderBy(ur => ur.Role.Name)
                    .Select(ur => new UserRoleDto(ur.RoleId, ur.Role.Name, ur.AssignedAtUtc, ur.ExpiresAtUtc))
                    .ToList(),
            })
            .ToListAsync(ct);

        var now = clock.GetUtcNow();
        return rows.Select(u => new UserDto(
                u.Id, u.Email!, u.FullName, u.OrganizationId, u.IsActive, u.IsSuperAdmin, u.IsInvited, u.TwoFactorEnabled,
                u.LockoutEnd > now ? u.LockoutEnd.Value.UtcDateTime : null,
                u.LastSignInAtUtc, u.CreatedAtUtc, u.Roles))
            .ToList();
    }

    private async Task<UserDto> LoadAsync(Guid id, CancellationToken ct) =>
        (await QueryUsers(db.Users.Where(u => u.Id == id), ct)).Single();

    private async Task<(ApplicationUser? User, Role? Role, ActionResult? Problem)> LoadAssignmentTargetsAsync(Guid userId, Guid roleId, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return (null, null, NotFound());
        if (!CanAccess(user.OrganizationId))
            return (null, null, Forbid());
        if (user.Id == currentUser.UserId)
            return (null, null, Problem(statusCode: 400, title: "You can't change your own roles", detail: "Ask another administrator to do it."));

        var role = await db.OrgRoles.Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == roleId && r.OrganizationId == user.OrganizationId, ct);
        if (role is null)
            return (null, null, NotFound());

        // Granting or removing a role is limited to roles within the caller's own permissions.
        var missing = currentUser.MissingPermissions(role.RolePermissions.Select(rp => rp.Permission.Code));
        return missing.Count > 0 ? (null, null, this.CannotDelegate(role.Name, missing)) : (user, role, null);
    }

    private async Task AddRolesAsync(Guid userId, Guid organizationId, IReadOnlyList<Guid>? roleIds, CancellationToken ct)
    {
        if (roleIds is null || roleIds.Count == 0)
            return;

        var validRoleIds = await db.OrgRoles
            .Where(r => r.OrganizationId == organizationId && roleIds.Contains(r.Id))
            .Select(r => r.Id)
            .ToListAsync(ct);
        foreach (var roleId in validRoleIds)
            db.OrgUserRoles.Add(new UserRole { UserId = userId, RoleId = roleId, AssignedAtUtc = Now, GrantedByUserId = currentUser.UserId });
    }

    /// <summary>The first requested role the caller may not grant (same rule as granting later), as a 403.</summary>
    private async Task<ActionResult?> DelegationProblemAsync(Guid organizationId, IReadOnlyList<Guid>? roleIds, CancellationToken ct)
    {
        if (roleIds is null || roleIds.Count == 0 || currentUser.IsSuperAdmin)
            return null;

        var roles = await db.OrgRoles.AsNoTracking()
            .Where(r => r.OrganizationId == organizationId && roleIds.Contains(r.Id))
            .Select(r => new { r.Name, Codes = r.RolePermissions.Select(rp => rp.Permission.Code).ToList() })
            .ToListAsync(ct);
        foreach (var role in roles)
        {
            var missing = currentUser.MissingPermissions(role.Codes);
            if (missing.Count > 0)
                return this.CannotDelegate(role.Name, missing);
        }
        return null;
    }

    /// <summary>Old access tokens stop working at once; the console refreshes and picks up the new permissions.</summary>
    private async Task PermissionsChangedAsync(Guid userId, string reason, CancellationToken ct)
    {
        await sessions.InvalidateAccessTokensAsync(userId, ct);
        await notifier.PermissionsChangedAsync(userId, reason, ct);
    }

    private async Task SendInvitationAsync(ApplicationUser user, CancellationToken ct)
    {
        var organizationName = await db.Organizations.Where(o => o.Id == user.OrganizationId).Select(o => o.Name).FirstOrDefaultAsync(ct) ?? "AccessHub";
        var token = await userManager.GenerateUserTokenAsync(user, InvitationTokenProvider.ProviderName, InvitationTokenProvider.Purpose);
        var webBaseUrl = (configuration["App:WebBaseUrl"] ?? "http://localhost:3000").TrimEnd('/');
        var link = $"{webBaseUrl}/accept-invite?user={user.Id}&token={Uri.EscapeDataString(token)}";
        emails.Enqueue(EmailTemplates.Invitation(user.Email!, user.FullName, organizationName, currentUser.DisplayName, link,
            configuration.GetValue("Auth:InvitationDays", 3)));
    }

    private ApplicationUser NewUser(string email, string fullName, Guid organizationId, bool emailConfirmed) => new()
    {
        Id = Guid.NewGuid(),
        UserName = email,
        Email = email,
        EmailConfirmed = emailConfirmed,
        FullName = fullName,
        OrganizationId = organizationId,
        IsActive = true,
        CreatedAtUtc = Now,
    };

    private ObjectResult EmailInUse() =>
        Problem(statusCode: 409, title: "Email already in use", detail: "Someone already has an account with this email.");

    private bool CanAccess(Guid? organizationId) =>
        currentUser.IsSuperAdmin || currentUser.OrganizationId == organizationId;
}
