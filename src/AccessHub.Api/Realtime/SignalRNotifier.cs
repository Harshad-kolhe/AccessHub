using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;
using Microsoft.AspNetCore.SignalR;

namespace AccessHub.Api.Realtime;

/// <summary>Sends small "something changed" messages; browsers re-fetch through the Next.js server.</summary>
public class SignalRNotifier(IHubContext<NotificationsHub> hub) : IRealtimeNotifier
{
    public Task PermissionsChangedAsync(Guid userId, string reason, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(NotificationsHub.UserGroup(userId)).SendAsync("permissionsChanged", new { reason }, cancellationToken);

    public Task AccessRequestCreatedAsync(Guid organizationId, Guid requestId, Guid requesterUserId, string requesterName, string roleName, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(NotificationsHub.ApproverGroup(organizationId))
            .SendAsync("accessRequestCreated", new { requestId, requesterUserId, requesterName, roleName }, cancellationToken);

    public Task AccessRequestDecidedAsync(Guid requesterUserId, Guid requestId, bool approved, string roleName, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(NotificationsHub.UserGroup(requesterUserId))
            .SendAsync("accessRequestDecided", new { requestId, approved, roleName }, cancellationToken);

    public async Task AuditEventsRecordedAsync(IReadOnlyList<AuditEvent> events, CancellationToken cancellationToken = default)
    {
        foreach (var organizationId in events.Select(e => e.OrganizationId).Distinct())
        {
            var count = events.Count(e => e.OrganizationId == organizationId);
            if (organizationId.HasValue)
                await hub.Clients.Group(NotificationsHub.OrganizationGroup(organizationId.Value)).SendAsync("auditEventsRecorded", new { count }, cancellationToken);
        }
        await hub.Clients.Group(NotificationsHub.PlatformGroup).SendAsync("auditEventsRecorded", new { count = events.Count }, cancellationToken);
    }
}
