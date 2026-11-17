using AccessHub.Application.DTOs;
using AccessHub.Domain.Entities;

namespace AccessHub.Application.Interfaces;

/// <summary>Where a request came from; stored with sessions and sign-in attempts.</summary>
public record ClientInfo(string? IpAddress, string? UserAgent);

public record RefreshedSession(SessionTokensDto Tokens, ApplicationUser User);

public interface ISessionService
{
    /// <summary>Starts a new session (refresh-token family) and returns its first token pair.</summary>
    Task<SessionTokensDto> StartAsync(ApplicationUser user, ClientInfo client, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rotates a refresh token. Presenting an already-rotated token outside a short grace window is treated as
    /// theft: the whole family is revoked and null is returned.
    /// </summary>
    Task<RefreshedSession?> RefreshAsync(string refreshToken, ClientInfo client, CancellationToken cancellationToken = default);

    /// <summary>Ends the session the token belongs to (sign out on this device).</summary>
    Task SignOutAsync(string refreshToken, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SessionDto>> ListAsync(Guid userId, Guid? currentSessionId, CancellationToken cancellationToken = default);

    /// <summary>Ends one of the user's sessions; false if it does not exist or is not theirs.</summary>
    Task<bool> RevokeAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>Signs the user out everywhere: revokes every session and invalidates outstanding access tokens.</summary>
    Task RevokeAllAsync(Guid userId, string reason, CancellationToken cancellationToken = default);

    /// <summary>
    /// Makes outstanding access tokens fail immediately (security stamp change). Sessions survive, so the next
    /// refresh issues a token with the user's current permissions.
    /// </summary>
    Task InvalidateAccessTokensAsync(Guid userId, CancellationToken cancellationToken = default);
}
