namespace AccessHub.Application.Interfaces;

/// <summary>
/// Checks on every request that an access token was issued for the user's current security stamp and that
/// the user is still active. Results are cached briefly so this costs at most one small query per user.
/// </summary>
public interface IAccessTokenValidator
{
    Task<bool> IsCurrentAsync(Guid userId, string? stampFingerprint, CancellationToken cancellationToken = default);

    /// <summary>Drops the cached stamp after it changes, so this instance notices immediately.</summary>
    void Forget(Guid userId);
}
