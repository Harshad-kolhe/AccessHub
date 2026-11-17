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
public class OrganizationsController(
    IAccessHubDbContext db,
    IAuditService audit,
    CurrentUserService currentUser,
    TimeProvider clock) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionCodes.OrganizationsManage)]
    public async Task<ActionResult<IEnumerable<OrganizationDto>>> GetAll(CancellationToken ct) =>
        Ok(await Project(db.Organizations).ToListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrganizationDto>> GetById(Guid id, CancellationToken ct)
    {
        if (!currentUser.IsSuperAdmin && currentUser.OrganizationId != id)
            return Forbid();

        var org = await Project(db.Organizations.Where(o => o.Id == id)).FirstOrDefaultAsync(ct);
        return org is null ? NotFound() : Ok(org);
    }

    [HttpPost]
    [Authorize(Policy = PermissionCodes.OrganizationsManage)]
    public async Task<ActionResult<OrganizationDto>> Create([FromBody] CreateOrganizationRequest request, CancellationToken ct)
    {
        var slug = request.Slug.ToLowerInvariant();
        if (await db.Organizations.AnyAsync(o => o.Slug == slug, ct))
            return SlugInUse(slug);

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Slug = slug,
            Accent = request.Accent,
            IsActive = true,
            CreatedAtUtc = clock.GetUtcNow().UtcDateTime,
        };
        db.Organizations.Add(org);
        audit.Record(currentUser.UserId, org.Id, "Created", "Organization", org.Id.ToString(), new { org.Name, org.Slug, org.Accent });
        await db.SaveChangesAsync(ct);

        var dto = await Project(db.Organizations.Where(o => o.Id == org.Id)).FirstAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = org.Id }, dto);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionCodes.OrganizationsManage)]
    public async Task<ActionResult<OrganizationDto>> Update(Guid id, [FromBody] UpdateOrganizationRequest request, CancellationToken ct)
    {
        var org = await db.Organizations.FindAsync([id], ct);
        if (org is null)
            return NotFound();

        var slug = request.Slug.ToLowerInvariant();
        // Checked here so a clash is a clear 409, not a unique-index error from SQL Server.
        if (await db.Organizations.AnyAsync(o => o.Slug == slug && o.Id != id, ct))
            return SlugInUse(slug);

        var before = new { org.Name, org.Slug, org.IsActive, org.Accent };
        org.Name = request.Name;
        org.Slug = slug;
        org.IsActive = request.IsActive;
        org.Accent = request.Accent;
        audit.Record(currentUser.UserId, org.Id, "Updated", "Organization", org.Id.ToString(), new
        {
            Before = before,
            After = new { org.Name, org.Slug, org.IsActive, org.Accent },
        });
        await db.SaveChangesAsync(ct);

        return Ok(await Project(db.Organizations.Where(o => o.Id == id)).FirstAsync(ct));
    }

    private IQueryable<OrganizationDto> Project(IQueryable<Organization> organizations) =>
        organizations.AsNoTracking()
            .OrderBy(o => o.Name)
            .Select(o => new OrganizationDto(
                o.Id, o.Name, o.Slug, o.IsActive, o.Accent,
                db.Users.Count(u => u.OrganizationId == o.Id),
                o.CreatedAtUtc));

    private ObjectResult SlugInUse(string slug) =>
        Problem(statusCode: 409, title: "Slug in use", detail: $"Another organization already uses \"{slug}\".");
}
