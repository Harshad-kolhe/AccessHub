using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AccessHub.Infrastructure.Services;

public static class RevokeReasons
{
    public const string Rotated = "Rotated";
    public const string SignedOut = "SignedOut";
    public const string SignedOutEverywhere = "SignedOutEverywhere";
    public const string ReuseDetected = "ReuseDetected";
    public const string Expired = "Expired";
    public const string UserDeactivated = "UserDeactivated";
    public const string PasswordReset = "PasswordReset";
}

/// <summary>
/// Sessions are refresh-token families. Each refresh rotates the token; presenting a token that was already
/// rotated (outside a short grace window for parallel requests) means it leaked, so the family is revoked.
/// </summary>
public class SessionService(
    AccessHubDbContext db,
    ITokenService tokens,
    UserManager<ApplicationUser> userManager,
    IAccessTokenValidator accessTokenValidator,
    IConfiguration configuration,
    TimeProvider clock,
    ILogger<SessionService> logger) : ISessionService
{
    private TimeSpan RefreshLifetime => TimeSpan.FromDays(configuration.GetValue("Auth:RefreshTokenDays", 7));
    private TimeSpan MaxSessionAge => TimeSpan.FromDays(configuration.GetValue("Auth:SessionMaxDays", 30));
    private TimeSpan ReuseGrace => TimeSpan.FromSeconds(configuration.GetValue("Auth:RefreshReuseGraceSeconds", 30));
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<SessionTokensDto> StartAsync(ApplicationUser user, ClientInfo client, CancellationToken cancellationToken = default)
    {
        var sessionId = Guid.NewGuid();
        var (refreshToken, entity) = NewRefreshToken(user.Id, sessionId, client);
        db.RefreshTokens.Add(entity);
        user.LastSignInAtUtc = Now;
        await db.SaveChangesAsync(cancellationToken);

        var access = await tokens.CreateAccessTokenAsync(user, sessionId, cancellationToken);
        return new SessionTokensDto(access.Token, access.ExpiresAtUtc, refreshToken, entity.ExpiresAtUtc, sessionId);
    }

    public async Task<RefreshedSession?> RefreshAsync(string refreshToken, ClientInfo client, CancellationToken cancellationToken = default)
    {
        var hash = SecurityStamps.HashToken(refreshToken);
        var stored = await db.RefreshTokens.Include(t => t.User).FirstOrDefaultAsync(t => t.TokenHash == hash, cancellationToken);
        if (stored is null)
            return null;

        var now = Now;
        if (stored.RevokedAtUtc is not null)
        {
            // Parallel requests (prefetches) may present the same token just after it was rotated: allow briefly.
            var rotatedMomentsAgo = stored.RevokedReason == RevokeReasons.Rotated && now - stored.RevokedAtUtc <= ReuseGrace;
            if (!rotatedMomentsAgo)
            {
                logger.LogWarning("Refresh token reuse detected for user {UserId}; revoking session {SessionId}", stored.UserId, stored.FamilyId);
                await RevokeFamilyAsync(stored.FamilyId, RevokeReasons.ReuseDetected, cancellationToken);
                return null;
            }
        }
        else if (stored.ExpiresAtUtc <= now)
        {
            return null;
        }

        if (!stored.User.IsActive)
        {
            await RevokeFamilyAsync(stored.FamilyId, RevokeReasons.UserDeactivated, cancellationToken);
            return null;
        }

        var sessionStarted = await db.RefreshTokens.Where(t => t.FamilyId == stored.FamilyId).MinAsync(t => t.CreatedAtUtc, cancellationToken);
        if (now - sessionStarted > MaxSessionAge)
        {
            await RevokeFamilyAsync(stored.FamilyId, RevokeReasons.Expired, cancellationToken);
            return null;
        }

        var (newToken, entity) = NewRefreshToken(stored.UserId, stored.FamilyId, client);
        db.RefreshTokens.Add(entity);
        if (stored.RevokedAtUtc is null)
        {
            stored.RevokedAtUtc = now;
            stored.RevokedReason = RevokeReasons.Rotated;
            stored.ReplacedByTokenId = entity.Id;
        }
        await db.SaveChangesAsync(cancellationToken);

        var access = await tokens.CreateAccessTokenAsync(stored.User, stored.FamilyId, cancellationToken);
        return new RefreshedSession(
            new SessionTokensDto(access.Token, access.ExpiresAtUtc, newToken, entity.ExpiresAtUtc, stored.FamilyId),
            stored.User);
    }

    public async Task SignOutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var hash = SecurityStamps.HashToken(refreshToken);
        var familyId = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).FirstOrDefaultAsync(cancellationToken);
        if (familyId is not null)
            await RevokeFamilyAsync(familyId.Value, RevokeReasons.SignedOut, cancellationToken);
    }

    public async Task<IReadOnlyList<SessionDto>> ListAsync(Guid userId, Guid? currentSessionId, CancellationToken cancellationToken = default)
    {
        var now = Now;
        var active = await db.RefreshTokens.AsNoTracking()
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null && t.ExpiresAtUtc > now)
            .ToListAsync(cancellationToken);
        if (active.Count == 0)
            return [];

        var sessionIds = active.Select(t => t.FamilyId).Distinct().ToList();
        var startedAt = await db.RefreshTokens.AsNoTracking()
            .Where(t => sessionIds.Contains(t.FamilyId))
            .GroupBy(t => t.FamilyId)
            .Select(g => new { SessionId = g.Key, Started = g.Min(t => t.CreatedAtUtc) })
            .ToDictionaryAsync(x => x.SessionId, x => x.Started, cancellationToken);

        return active
            .GroupBy(t => t.FamilyId)
            .Select(g => g.OrderByDescending(t => t.CreatedAtUtc).First())
            .Select(t => new SessionDto(t.FamilyId, startedAt[t.FamilyId], t.CreatedAtUtc, t.ExpiresAtUtc, t.IpAddress, t.UserAgent, t.FamilyId == currentSessionId))
            .OrderByDescending(s => s.IsCurrent)
            .ThenByDescending(s => s.LastActiveAtUtc)
            .ToList();
    }

    public async Task<bool> RevokeAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default)
    {
        var owned = await db.RefreshTokens.AnyAsync(t => t.UserId == userId && t.FamilyId == sessionId && t.RevokedAtUtc == null, cancellationToken);
        if (!owned)
            return false;

        await RevokeFamilyAsync(sessionId, RevokeReasons.SignedOut, cancellationToken);
        // The revoked device may still hold a valid access token; changing the stamp ends it now.
        // Other sessions simply refresh and carry on.
        await InvalidateAccessTokensAsync(userId, cancellationToken);
        return true;
    }

    public async Task RevokeAllAsync(Guid userId, string reason, CancellationToken cancellationToken = default)
    {
        var now = Now;
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAtUtc, now).SetProperty(t => t.RevokedReason, reason), cancellationToken);
        await InvalidateAccessTokensAsync(userId, cancellationToken);
    }

    public async Task InvalidateAccessTokensAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return;

        await userManager.UpdateSecurityStampAsync(user);
        accessTokenValidator.Forget(userId);
    }

    private async Task RevokeFamilyAsync(Guid familyId, string reason, CancellationToken cancellationToken)
    {
        var now = Now;
        await db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAtUtc, now).SetProperty(t => t.RevokedReason, reason), cancellationToken);
    }

    private (string Token, RefreshToken Entity) NewRefreshToken(Guid userId, Guid familyId, ClientInfo client)
    {
        var token = SecurityStamps.NewToken();
        var entity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FamilyId = familyId,
            TokenHash = SecurityStamps.HashToken(token),
            CreatedAtUtc = Now,
            ExpiresAtUtc = Now.Add(RefreshLifetime),
            IpAddress = Truncate(client.IpAddress, 64),
            UserAgent = Truncate(client.UserAgent, 256),
        };
        return (token, entity);
    }

    private static string? Truncate(string? value, int length) =>
        value is null || value.Length <= length ? value : value[..length];
}
