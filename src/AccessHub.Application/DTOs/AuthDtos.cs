namespace AccessHub.Application.DTOs;

public record LoginRequest(string Email, string Password);

public record TwoFactorLoginRequest(string ChallengeToken, string Code, bool IsRecoveryCode = false);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record RegisterRequest(
    string OrganizationName,
    string FullName,
    string Email,
    string Password);

public record ForgotPasswordRequest(string Email);

public record ResetPasswordRequest(string Email, string Token, string Password);

public record AcceptInviteRequest(Guid UserId, string Token, string Password);

public record ExternalExchangeRequest(string Code);

public record CurrentUserDto(
    Guid UserId,
    string Email,
    string FullName,
    Guid? OrganizationId,
    string? OrganizationName,
    string? OrganizationAccent,
    bool IsSuperAdmin,
    bool TwoFactorEnabled,
    Guid? SessionId,
    IReadOnlyList<string> Permissions);

/// <summary>A short-lived access token plus the rotating refresh token that renews it.</summary>
public record SessionTokensDto(
    string AccessToken,
    DateTime AccessTokenExpiresAtUtc,
    string RefreshToken,
    DateTime RefreshTokenExpiresAtUtc,
    Guid SessionId);

/// <summary>
/// Returned by every endpoint that signs someone in. With two-factor enabled the first step returns only
/// a challenge token, which the second step exchanges (with a code) for tokens.
/// </summary>
public record AuthResponse(bool RequiresTwoFactor, string? ChallengeToken, SessionTokensDto? Tokens, CurrentUserDto? User);

public record ExternalProviderDto(string Name, string DisplayName);
