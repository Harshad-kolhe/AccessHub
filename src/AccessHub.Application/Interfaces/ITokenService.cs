using AccessHub.Domain.Entities;

namespace AccessHub.Application.Interfaces;

public record IssuedToken(string Token, DateTime ExpiresAtUtc);

public interface ITokenService
{
    /// <summary>
    /// Short-lived JWT with the user's permissions, the session (refresh-token family) id and a fingerprint of
    /// the security stamp, so the API can reject it as soon as the stamp changes.
    /// </summary>
    Task<IssuedToken> CreateAccessTokenAsync(ApplicationUser user, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>Five-minute token proving the password step of a two-factor sign-in passed.</summary>
    IssuedToken CreateTwoFactorChallenge(Guid userId);

    /// <summary>Returns the user id from a valid, unexpired challenge, otherwise null.</summary>
    Guid? ReadTwoFactorChallenge(string challengeToken);

    /// <summary>Two-minute ticket that only the realtime hub accepts (the session token never reaches the browser).</summary>
    IssuedToken CreateRealtimeTicket(Guid userId, Guid? organizationId, bool isSuperAdmin, bool canApprove);
}
