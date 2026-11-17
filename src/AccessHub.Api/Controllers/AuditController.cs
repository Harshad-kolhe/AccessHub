using System.Text;
using AccessHub.Api.Services;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Controllers;

public record AuditFilter(Guid? OrganizationId, DateTime? From, DateTime? To, Guid? ActorId, string? EntityType, string? Action);

public record AuditFacetsDto(IReadOnlyList<AuditActorDto> Actors, IReadOnlyList<string> EntityTypes, IReadOnlyList<string> Actions);

public record AuditActorDto(Guid Id, string Name);

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = PermissionCodes.AuditRead)]
public class AuditController(IAccessHubDbContext db, CurrentUserService currentUser, TimeProvider clock) : ControllerBase
{
    private const int MaxExportRows = 10_000;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditEventDto>>> GetAll(
        [FromQuery] AuditFilter filter,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var events = Filter(filter);
        var total = await events.CountAsync(ct);
        var items = await WithActors(events.OrderByDescending(a => a.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize))
            .ToListAsync(ct);
        return Ok(new PagedResult<AuditEventDto>(items, total, page, pageSize));
    }

    /// <summary>Values for the filter controls: who acted, on what, and how.</summary>
    [HttpGet("facets")]
    public async Task<ActionResult<AuditFacetsDto>> Facets([FromQuery] Guid? organizationId, CancellationToken ct)
    {
        var events = Filter(new AuditFilter(organizationId, null, null, null, null, null));
        var actorIds = await events.Select(a => a.ActorUserId).Distinct().ToListAsync(ct);
        var actors = await db.Users.Where(u => actorIds.Contains(u.Id)).Select(u => new AuditActorDto(u.Id, u.FullName)).ToListAsync(ct);
        if (actorIds.Contains(AuditActors.System))
            actors.Add(new AuditActorDto(AuditActors.System, "System"));

        return Ok(new AuditFacetsDto(
            actors.OrderBy(a => a.Name).ToList(),
            await events.Select(a => a.EntityType).Distinct().OrderBy(t => t).ToListAsync(ct),
            await events.Select(a => a.Action).Distinct().OrderBy(a => a).ToListAsync(ct)));
    }

    /// <summary>The filtered log as CSV (newest first, at most 10,000 rows).</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] AuditFilter filter, CancellationToken ct)
    {
        var rows = await WithActors(Filter(filter).OrderByDescending(a => a.CreatedAtUtc).Take(MaxExportRows)).ToListAsync(ct);

        var csv = new StringBuilder();
        csv.AppendLine("TimestampUtc,Action,EntityType,EntityId,Actor,ActorEmail,Payload");
        foreach (var row in rows)
        {
            csv.AppendJoin(',',
                Cell(row.CreatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss")),
                Cell(row.Action),
                Cell(row.EntityType),
                Cell(row.EntityId),
                Cell(row.ActorName),
                Cell(row.ActorEmail),
                Cell(row.PayloadJson));
            csv.AppendLine();
        }

        var fileName = $"accesshub-audit-{clock.GetUtcNow():yyyyMMdd-HHmm}.csv";
        return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray(), "text/csv", fileName);
    }

    private IQueryable<AuditEvent> Filter(AuditFilter filter)
    {
        // The tenant query filter already limits organization users to their own organization;
        // super admins may narrow to one organization.
        var events = db.AuditEvents.AsNoTracking();
        if (currentUser.IsSuperAdmin && filter.OrganizationId.HasValue)
            events = events.Where(a => a.OrganizationId == filter.OrganizationId);
        if (filter.From.HasValue)
            events = events.Where(a => a.CreatedAtUtc >= filter.From.Value);
        if (filter.To.HasValue)
            events = events.Where(a => a.CreatedAtUtc < filter.To.Value);
        if (filter.ActorId.HasValue)
            events = events.Where(a => a.ActorUserId == filter.ActorId.Value);
        if (!string.IsNullOrWhiteSpace(filter.EntityType))
            events = events.Where(a => a.EntityType == filter.EntityType);
        if (!string.IsNullOrWhiteSpace(filter.Action))
            events = events.Where(a => a.Action == filter.Action);
        return events;
    }

    /// <summary>Joins actor names in SQL, so the log shows people rather than ids.</summary>
    private IQueryable<AuditEventDto> WithActors(IQueryable<AuditEvent> events) =>
        from a in events
        join u in db.Users on a.ActorUserId equals u.Id into actors
        from actor in actors.DefaultIfEmpty()
        select new AuditEventDto(
            a.Id,
            a.OrganizationId,
            a.ActorUserId,
            a.ActorUserId == AuditActors.System ? "System" : actor != null ? actor.FullName : "Deleted user",
            actor != null ? actor.Email : null,
            a.Action,
            a.EntityType,
            a.EntityId,
            a.PayloadJson,
            a.CreatedAtUtc);

    /// <summary>Quotes a CSV cell and defuses spreadsheet formulas (cells starting with = + - @).</summary>
    private static string Cell(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";
        if (value[0] is '=' or '+' or '-' or '@')
            value = "'" + value;
        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
}
