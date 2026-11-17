using AccessHub.Api.Services;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Controllers;

/// <summary>Sample business data: shows what organization-scoped permissions protect.</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InvoicesController(
    IAccessHubDbContext db,
    IAuditService audit,
    CurrentUserService currentUser,
    TimeProvider clock) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionCodes.InvoicesRead)]
    public async Task<ActionResult<IEnumerable<InvoiceDto>>> GetAll(CancellationToken ct)
    {
        var orgId = currentUser.OrganizationId;
        if (orgId is null && !currentUser.IsSuperAdmin)
            return Forbid();

        var query = db.Invoices.AsNoTracking();
        if (orgId.HasValue)
            query = query.Where(i => i.OrganizationId == orgId.Value);

        return Ok(await query
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new InvoiceDto(i.Id, i.Number, i.CustomerName, i.Amount, i.CreatedAtUtc))
            .ToListAsync(ct));
    }

    [HttpPost]
    [Authorize(Policy = PermissionCodes.InvoicesWrite)]
    public async Task<ActionResult<InvoiceDto>> Create([FromBody] CreateInvoiceRequest request, CancellationToken ct)
    {
        var orgId = currentUser.OrganizationId;
        if (orgId is null)
            return Problem(statusCode: 400, title: "Organization required", detail: "Invoices belong to an organization. Sign in as an organization user.");

        if (await db.Invoices.AnyAsync(i => i.OrganizationId == orgId && i.Number == request.Number, ct))
            return Problem(statusCode: 409, title: "Invoice number in use", detail: $"There is already an invoice {request.Number}.");

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId.Value,
            Number = request.Number,
            CustomerName = request.CustomerName,
            Amount = request.Amount,
            CreatedAtUtc = clock.GetUtcNow().UtcDateTime,
        };
        db.Invoices.Add(invoice);
        audit.Record(currentUser.UserId, orgId, "Created", "Invoice", invoice.Id.ToString(), new
        {
            Name = invoice.Number,
            invoice.Number,
            invoice.CustomerName,
            invoice.Amount,
        });
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), null,
            new InvoiceDto(invoice.Id, invoice.Number, invoice.CustomerName, invoice.Amount, invoice.CreatedAtUtc));
    }
}
