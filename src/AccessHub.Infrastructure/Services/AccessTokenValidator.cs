using AccessHub.Application.Interfaces;
using AccessHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AccessHub.Infrastructure.Services;

public class AccessTokenValidator(AccessHubDbContext db, IMemoryCache cache) : IAccessTokenValidator
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    private sealed record UserState(string StampFingerprint, bool IsActive);

    public async Task<bool> IsCurrentAsync(Guid userId, string? stampFingerprint, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(stampFingerprint))
            return false;

        var state = await cache.GetOrCreateAsync(CacheKey(userId), async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheFor;
            var user = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.SecurityStamp, u.IsActive })
                .FirstOrDefaultAsync(cancellationToken);
            return user is null ? null : new UserState(SecurityStamps.Fingerprint(user.SecurityStamp), user.IsActive);
        });

        return state is not null && state.IsActive && state.StampFingerprint == stampFingerprint;
    }

    public void Forget(Guid userId) => cache.Remove(CacheKey(userId));

    private static string CacheKey(Guid userId) => $"access-token-state:{userId}";
}
