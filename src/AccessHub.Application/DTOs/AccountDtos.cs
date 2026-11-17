namespace AccessHub.Application.DTOs;

public record TwoFactorStatusDto(bool Enabled, int RecoveryCodesLeft);

public record TwoFactorSetupDto(string SharedKey, string AuthenticatorUri);

public record TwoFactorCodeRequest(string Code);

public record RecoveryCodesDto(IReadOnlyList<string> RecoveryCodes);

/// <summary>One signed-in device: a refresh-token family.</summary>
public record SessionDto(
    Guid Id,
    DateTime StartedAtUtc,
    DateTime LastActiveAtUtc,
    DateTime ExpiresAtUtc,
    string? IpAddress,
    string? UserAgent,
    bool IsCurrent);
