using System.Text.Json;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;

namespace AccessHub.Infrastructure.Services;

public class AuditService(IAccessHubDbContext db, TimeProvider clock) : IAuditService
{
    public void Record(Guid actorUserId, Guid? organizationId, string action, string entityType, string? entityId, object? payload = null)
    {
        db.AuditEvents.Add(new AuditEvent
        {
            Id = Guid.NewGuid(),
            ActorUserId = actorUserId,
            OrganizationId = organizationId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            PayloadJson = payload is null ? null : JsonSerializer.Serialize(payload),
            CreatedAtUtc = clock.GetUtcNow().UtcDateTime
        });
    }

    public async Task LogAsync(
        Guid actorUserId,
        Guid? organizationId,
        string action,
        string entityType,
        string? entityId,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        Record(actorUserId, organizationId, action, entityType, entityId, payload);
        await db.SaveChangesAsync(cancellationToken);
    }
}
