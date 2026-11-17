using AccessHub.Domain.Entities;

namespace AccessHub.Application.Interfaces;

/// <summary>Pushes live updates to connected browsers (implemented with SignalR in the API).</summary>
public interface IRealtimeNotifier
{
    /// <summary>The user's roles or permissions changed: their console should refresh its session and view.</summary>
    Task PermissionsChangedAsync(Guid userId, string reason, CancellationToken cancellationToken = default);

    /// <summary>Tells the organization's approvers (people with users.write) that someone is waiting for a decision.</summary>
    Task AccessRequestCreatedAsync(Guid organizationId, Guid requestId, Guid requesterUserId, string requesterName, string roleName, CancellationToken cancellationToken = default);

    Task AccessRequestDecidedAsync(Guid requesterUserId, Guid requestId, bool approved, string roleName, CancellationToken cancellationToken = default);

    /// <summary>New audit events were saved; live views (audit log, dashboard) can refresh.</summary>
    Task AuditEventsRecordedAsync(IReadOnlyList<AuditEvent> events, CancellationToken cancellationToken = default);
}
