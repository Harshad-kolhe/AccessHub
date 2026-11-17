using AccessHub.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AccessHub.Api.Realtime;

/// <summary>
/// Live updates for the console. Browsers connect with a short-lived realtime ticket (see RealtimeController),
/// never with the session token, which stays in the Next.js server's httpOnly cookie. Messages only say that
/// something changed; the browser re-reads the data through Next.js with the user's own permissions.
/// </summary>
[Authorize(AuthenticationSchemes = RealtimeTicket.Scheme)]
public class NotificationsHub : Hub
{
    public const string Path = "/hubs/notifications";

    public static string UserGroup(Guid userId) => $"user:{userId}";
    public static string OrganizationGroup(Guid organizationId) => $"org:{organizationId}";
    public static string ApproverGroup(Guid organizationId) => $"approvers:{organizationId}";
    public const string PlatformGroup = "platform";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User!;
        if (Guid.TryParse(user.FindFirst(AccessHubClaims.Subject)?.Value, out var userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        if (Guid.TryParse(user.FindFirst(AccessHubClaims.OrganizationId)?.Value, out var organizationId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, OrganizationGroup(organizationId));
            if (user.HasClaim(AccessHubClaims.CanApprove, "true"))
                await Groups.AddToGroupAsync(Context.ConnectionId, ApproverGroup(organizationId));
        }
        if (user.HasClaim(AccessHubClaims.SuperAdmin, "true"))
            await Groups.AddToGroupAsync(Context.ConnectionId, PlatformGroup);

        await base.OnConnectedAsync();
    }
}

public static class RealtimeTicket
{
    /// <summary>Authentication scheme that accepts only realtime tickets (their own audience), on the hub only.</summary>
    public const string Scheme = "RealtimeTicket";
}
