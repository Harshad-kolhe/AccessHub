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

/// <summary>
/// Users ask for a role (often because a page needed one of its permissions); approvers with users.write decide.
/// Approval assigns the role, optionally only for a limited time, and every step is audited.
/// </summary>
[ApiController]
[Route("api/access-requests")]
[Authorize]
public class AccessRequestsController(
    IAccessHubDbContext db,
    IAuditService audit,
    ISessionService sessions,
    IRealtimeNotifier notifier,
    CurrentUserService currentUser,
    TimeProvider clock) : ControllerBase
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>scope=mine (default): your own requests; scope=pending or all: the organization's (approvers only).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AccessRequestDto>>> GetAll([FromQuery] string scope = "mine", CancellationToken ct = default)
    {
        var requests = db.AccessRequests.AsNoTracking();
        switch (scope)
        {
            case "mine":
                requests = requests.Where(r => r.RequesterUserId == currentUser.UserId);
                break;
            case "pending" or "all" when currentUser.HasPermission(PermissionCodes.UsersWrite):
                if (scope == "pending")
                    requests = requests.Where(r => r.Status == AccessRequestStatus.Pending);
                break;
            default:
                return Forbid();
        }

        return Ok(await Project(requests).ToListAsync(ct));
    }

    /// <summary>Roles in your organization that grant a permission: the choices for a new request.</summary>
    [HttpGet("options")]
    public async Task<ActionResult<IEnumerable<RoleOptionDto>>> Options([FromQuery] string? permission, CancellationToken ct)
    {
        if (currentUser.OrganizationId is null)
            return Ok(Array.Empty<RoleOptionDto>());

        var roles = db.OrgRoles.AsNoTracking().Where(r => r.OrganizationId == currentUser.OrganizationId);
        if (!string.IsNullOrWhiteSpace(permission))
            roles = roles.Where(r => r.RolePermissions.Any(rp => rp.Permission.Code == permission));

        return Ok(await roles
            .OrderBy(r => r.RolePermissions.Count)
            .ThenBy(r => r.Name)
            .Select(r => new RoleOptionDto(r.Id, r.Name, r.Description, r.RolePermissions.Select(rp => rp.Permission.Code).ToList()))
            .ToListAsync(ct));
    }

    [HttpPost]
    public async Task<ActionResult<AccessRequestDto>> Create([FromBody] CreateAccessRequestRequest request, CancellationToken ct)
    {
        if (currentUser.OrganizationId is null)
            return Problem(statusCode: 400, title: "No organization", detail: "Super admins already hold every permission.");

        var role = await db.OrgRoles.FirstOrDefaultAsync(r => r.Id == request.RoleId && r.OrganizationId == currentUser.OrganizationId, ct);
        if (role is null)
            return NotFound();
        if (await db.OrgUserRoles.AnyAsync(ur => ur.UserId == currentUser.UserId && ur.RoleId == role.Id && (ur.ExpiresAtUtc == null || ur.ExpiresAtUtc > Now), ct))
            return Problem(statusCode: 409, title: "You already have this role", detail: $"You already hold {role.Name}.");
        if (await db.AccessRequests.AnyAsync(r => r.RequesterUserId == currentUser.UserId && r.RoleId == role.Id && r.Status == AccessRequestStatus.Pending, ct))
            return Problem(statusCode: 409, title: "Already requested", detail: $"Your request for {role.Name} is waiting for an approver.");

        var accessRequest = new AccessRequest
        {
            Id = Guid.NewGuid(),
            OrganizationId = role.OrganizationId,
            RequesterUserId = currentUser.UserId,
            RoleId = role.Id,
            Permission = request.Permission,
            Reason = request.Reason.Trim(),
            Status = AccessRequestStatus.Pending,
            CreatedAtUtc = Now,
        };
        db.AccessRequests.Add(accessRequest);
        audit.Record(currentUser.UserId, role.OrganizationId, "Requested", "AccessRequest", accessRequest.Id.ToString(), new
        {
            Name = role.Name,
            Role = role.Name,
            request.Permission,
            accessRequest.Reason,
        });
        await db.SaveChangesAsync(ct);

        await notifier.AccessRequestCreatedAsync(role.OrganizationId, accessRequest.Id, currentUser.UserId, currentUser.DisplayName, role.Name, ct);
        return Ok(await Project(db.AccessRequests.Where(r => r.Id == accessRequest.Id)).FirstAsync(ct));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<AccessRequestDto>> Approve(Guid id, [FromBody] ApproveAccessRequestRequest request, CancellationToken ct)
    {
        var (accessRequest, problem) = await LoadPendingForDecisionAsync(id, ct);
        if (problem is not null)
            return problem;

        // An approver can only hand out access they hold themselves.
        var roleCodes = await db.RolePermissions.Where(rp => rp.RoleId == accessRequest!.RoleId).Select(rp => rp.Permission.Code).ToListAsync(ct);
        var missing = currentUser.MissingPermissions(roleCodes);
        if (missing.Count > 0)
            return this.CannotDelegate(accessRequest!.Role.Name, missing);

        var assignment = await db.OrgUserRoles.FirstOrDefaultAsync(ur => ur.UserId == accessRequest!.RequesterUserId && ur.RoleId == accessRequest.RoleId, ct);
        if (assignment is null)
        {
            assignment = new UserRole { UserId = accessRequest!.RequesterUserId, RoleId = accessRequest.RoleId, AssignedAtUtc = Now, GrantedByUserId = currentUser.UserId };
            db.OrgUserRoles.Add(assignment);
        }
        assignment.ExpiresAtUtc = request.ExpiresAtUtc;

        Decide(accessRequest!, AccessRequestStatus.Approved, request.Note);
        accessRequest!.GrantExpiresAtUtc = request.ExpiresAtUtc;
        audit.Record(currentUser.UserId, accessRequest.OrganizationId, "Approved", "AccessRequest", accessRequest.Id.ToString(), new
        {
            Name = $"{accessRequest.Requester.FullName}: {accessRequest.Role.Name}",
            Requester = accessRequest.Requester.FullName,
            Role = accessRequest.Role.Name,
            request.ExpiresAtUtc,
            request.Note,
        });
        await db.SaveChangesAsync(ct);

        await sessions.InvalidateAccessTokensAsync(accessRequest.RequesterUserId, ct);
        await notifier.PermissionsChangedAsync(accessRequest.RequesterUserId, $"Your request for {accessRequest.Role.Name} was approved.", ct);
        await notifier.AccessRequestDecidedAsync(accessRequest.RequesterUserId, accessRequest.Id, true, accessRequest.Role.Name, ct);
        return Ok(await Project(db.AccessRequests.Where(r => r.Id == id)).FirstAsync(ct));
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionCodes.UsersWrite)]
    public async Task<ActionResult<AccessRequestDto>> Reject(Guid id, [FromBody] RejectAccessRequestRequest request, CancellationToken ct)
    {
        var (accessRequest, problem) = await LoadPendingForDecisionAsync(id, ct);
        if (problem is not null)
            return problem;

        Decide(accessRequest!, AccessRequestStatus.Rejected, request.Note);
        audit.Record(currentUser.UserId, accessRequest!.OrganizationId, "Rejected", "AccessRequest", accessRequest.Id.ToString(), new
        {
            Name = $"{accessRequest.Requester.FullName}: {accessRequest.Role.Name}",
            Requester = accessRequest.Requester.FullName,
            Role = accessRequest.Role.Name,
            request.Note,
        });
        await db.SaveChangesAsync(ct);

        await notifier.AccessRequestDecidedAsync(accessRequest.RequesterUserId, accessRequest.Id, false, accessRequest.Role.Name, ct);
        return Ok(await Project(db.AccessRequests.Where(r => r.Id == id)).FirstAsync(ct));
    }

    /// <summary>The requester withdraws a pending request.</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<AccessRequestDto>> Cancel(Guid id, CancellationToken ct)
    {
        var accessRequest = await db.AccessRequests.Include(r => r.Role).FirstOrDefaultAsync(r => r.Id == id && r.RequesterUserId == currentUser.UserId, ct);
        if (accessRequest is null)
            return NotFound();
        if (accessRequest.Status != AccessRequestStatus.Pending)
            return AlreadyDecided();

        accessRequest.Status = AccessRequestStatus.Cancelled;
        accessRequest.DecidedAtUtc = Now;
        accessRequest.DecidedByUserId = currentUser.UserId;
        audit.Record(currentUser.UserId, accessRequest.OrganizationId, "Cancelled", "AccessRequest", accessRequest.Id.ToString(), new { Name = accessRequest.Role.Name, Role = accessRequest.Role.Name });
        await db.SaveChangesAsync(ct);
        return Ok(await Project(db.AccessRequests.Where(r => r.Id == id)).FirstAsync(ct));
    }

    private async Task<(AccessRequest? Request, ActionResult? Problem)> LoadPendingForDecisionAsync(Guid id, CancellationToken ct)
    {
        var accessRequest = await db.AccessRequests
            .Include(r => r.Role)
            .Include(r => r.Requester)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
        if (accessRequest is null)
            return (null, NotFound());
        if (accessRequest.Status != AccessRequestStatus.Pending)
            return (null, AlreadyDecided());
        // Separation of duties: nobody approves (or rejects) their own request.
        if (accessRequest.RequesterUserId == currentUser.UserId)
            return (null, Problem(statusCode: 403, title: "You can't decide your own request", detail: "Another approver has to review it."));
        return (accessRequest, null);
    }

    private void Decide(AccessRequest accessRequest, AccessRequestStatus status, string? note)
    {
        accessRequest.Status = status;
        accessRequest.DecidedByUserId = currentUser.UserId;
        accessRequest.DecidedAtUtc = Now;
        accessRequest.DecisionNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
    }

    private ObjectResult AlreadyDecided() =>
        Problem(statusCode: 409, title: "Already decided", detail: "This request is no longer pending.");

    private IQueryable<AccessRequestDto> Project(IQueryable<AccessRequest> requests) =>
        from r in requests
        join decider in db.Users on r.DecidedByUserId equals decider.Id into deciders
        from decidedBy in deciders.DefaultIfEmpty()
        orderby r.Status == AccessRequestStatus.Pending descending, r.CreatedAtUtc descending
        select new AccessRequestDto(
            r.Id,
            r.RequesterUserId,
            r.Requester.FullName,
            r.Requester.Email!,
            r.RoleId,
            r.Role.Name,
            r.Permission,
            r.Reason,
            r.Status.ToString(),
            r.CreatedAtUtc,
            decidedBy != null ? decidedBy.FullName : null,
            r.DecidedAtUtc,
            r.DecisionNote,
            r.GrantExpiresAtUtc);
}
