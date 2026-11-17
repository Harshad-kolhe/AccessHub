using AccessHub.Api.Services;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Controllers;

/// <summary>The access checker: is a permission granted to a user right now, and by which roles?</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PermissionCodes.UsersRead)]
[Authorize(Policy = PermissionCodes.RolesRead)]
public class AccessController(IAccessHubDbContext db, IPermissionService permissions, CurrentUserService currentUser, TimeProvider clock) : ControllerBase
{
    [HttpGet("check")]
    public async Task<ActionResult<AccessCheckDto>> Check([FromQuery] Guid userId, [FromQuery] string permission, CancellationToken ct)
    {
        if (!PermissionCodes.All.Contains(permission))
            return Problem(statusCode: 400, title: "Unknown permission", detail: $"'{permission}' is not a permission.");

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || (!currentUser.IsSuperAdmin && user.OrganizationId != currentUser.OrganizationId))
            return NotFound();

        var effective = await permissions.GetUserPermissionsAsync(user.Id, ct);
        if (user.IsSuperAdmin)
            return new AccessCheckDto(user.Id, user.FullName, permission, true, true, [], effective);

        var now = clock.GetUtcNow().UtcDateTime;
        var grantedBy = await db.OrgUserRoles.AsNoTracking()
            .Where(ur => ur.UserId == user.Id
                         && (ur.ExpiresAtUtc == null || ur.ExpiresAtUtc > now)
                         && ur.Role.RolePermissions.Any(rp => rp.Permission.Code == permission))
            .OrderBy(ur => ur.Role.Name)
            .Select(ur => new GrantingRoleDto(ur.RoleId, ur.Role.Name, ur.ExpiresAtUtc))
            .ToListAsync(ct);

        return new AccessCheckDto(user.Id, user.FullName, permission, grantedBy.Count > 0, false, grantedBy, effective);
    }
}

/// <summary>Issues the short-lived ticket a browser uses to open the realtime connection.</summary>
[ApiController]
[Route("api/realtime")]
[Authorize]
public class RealtimeController(ITokenService tokens, CurrentUserService currentUser) : ControllerBase
{
    [HttpPost("ticket")]
    public ActionResult<RealtimeTicketDto> Ticket()
    {
        var ticket = tokens.CreateRealtimeTicket(
            currentUser.UserId, currentUser.OrganizationId, currentUser.IsSuperAdmin, currentUser.HasPermission(PermissionCodes.UsersWrite));
        return new RealtimeTicketDto(ticket.Token, ticket.ExpiresAtUtc, Realtime.NotificationsHub.Path);
    }
}
