using System.Text;
using AccessHub.Api.Extensions;
using AccessHub.Api.Services;
using AccessHub.Infrastructure.Seed;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AccessHub.Api.Controllers;

/// <summary>Self-service security settings for the signed-in user: two-factor sign-in and sessions.</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountController(
    UserManager<ApplicationUser> userManager,
    ISessionService sessions,
    IAccessTokenValidator accessTokenValidator,
    IAuditService audit,
    IConfiguration configuration,
    CurrentUserService currentUser) : ControllerBase
{
    private const string Issuer = "AccessHub";

    [HttpGet("two-factor")]
    public async Task<ActionResult<TwoFactorStatusDto>> TwoFactorStatus()
    {
        var user = await CurrentAsync();
        return new TwoFactorStatusDto(user.TwoFactorEnabled, await userManager.CountRecoveryCodesAsync(user));
    }

    /// <summary>Creates (or reuses) the authenticator key and returns it with the otpauth:// URI for the QR code.</summary>
    [HttpPost("two-factor/setup")]
    public async Task<ActionResult<TwoFactorSetupDto>> SetupTwoFactor()
    {
        var user = await CurrentAsync();
        if (DemoAccounts.IsProtected(configuration, user.Email))
            return this.DemoAccountProtected("two-factor sign-in");
        if (user.TwoFactorEnabled)
            return Problem(statusCode: 409, title: "Two-factor sign-in is already on", detail: "Turn it off first to set up a new authenticator.");

        var key = await userManager.GetAuthenticatorKeyAsync(user);
        if (string.IsNullOrEmpty(key))
        {
            await userManager.ResetAuthenticatorKeyAsync(user);
            key = await userManager.GetAuthenticatorKeyAsync(user);
        }

        var uri = $"otpauth://totp/{Uri.EscapeDataString(Issuer)}:{Uri.EscapeDataString(user.Email!)}?secret={key}&issuer={Uri.EscapeDataString(Issuer)}&digits=6";
        return new TwoFactorSetupDto(FormatKey(key!), uri);
    }

    [HttpPost("two-factor/enable")]
    public async Task<ActionResult<RecoveryCodesDto>> EnableTwoFactor([FromBody] TwoFactorCodeRequest request, CancellationToken ct)
    {
        var user = await CurrentAsync();
        if (DemoAccounts.IsProtected(configuration, user.Email))
            return this.DemoAccountProtected("two-factor sign-in");
        if (!await VerifyAuthenticatorCodeAsync(user, request.Code))
            return InvalidCode();

        await userManager.SetTwoFactorEnabledAsync(user, true);
        var codes = await userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, 8);
        accessTokenValidator.Forget(user.Id);
        await audit.LogAsync(user.Id, user.OrganizationId, "EnabledTwoFactor", "User", user.Id.ToString(), new { user.Email, user.FullName }, ct);
        return new RecoveryCodesDto(codes?.ToList() ?? []);
    }

    [HttpPost("two-factor/disable")]
    public async Task<IActionResult> DisableTwoFactor([FromBody] TwoFactorCodeRequest request, CancellationToken ct)
    {
        var user = await CurrentAsync();
        if (!user.TwoFactorEnabled)
            return NoContent();
        if (!await VerifyAuthenticatorCodeAsync(user, request.Code))
            return InvalidCode();

        await userManager.SetTwoFactorEnabledAsync(user, false);
        await userManager.ResetAuthenticatorKeyAsync(user);
        accessTokenValidator.Forget(user.Id);
        await audit.LogAsync(user.Id, user.OrganizationId, "DisabledTwoFactor", "User", user.Id.ToString(), new { user.Email, user.FullName }, ct);
        return NoContent();
    }

    [HttpPost("two-factor/recovery-codes")]
    public async Task<ActionResult<RecoveryCodesDto>> NewRecoveryCodes([FromBody] TwoFactorCodeRequest request)
    {
        var user = await CurrentAsync();
        if (!user.TwoFactorEnabled)
            return Problem(statusCode: 409, title: "Two-factor sign-in is off", detail: "Turn it on first.");
        if (!await VerifyAuthenticatorCodeAsync(user, request.Code))
            return InvalidCode();

        var codes = await userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, 8);
        return new RecoveryCodesDto(codes?.ToList() ?? []);
    }

    [HttpGet("sessions")]
    public async Task<ActionResult<IEnumerable<SessionDto>>> Sessions(CancellationToken ct) =>
        Ok(await sessions.ListAsync(currentUser.UserId, currentUser.SessionId, ct));

    [HttpDelete("sessions/{id:guid}")]
    public async Task<IActionResult> RevokeSession(Guid id, CancellationToken ct) =>
        await sessions.RevokeAsync(currentUser.UserId, id, ct) ? NoContent() : NotFound();

    /// <summary>Signs out every device, this one included.</summary>
    [HttpPost("sessions/revoke-all")]
    public async Task<IActionResult> RevokeAllSessions(CancellationToken ct)
    {
        await sessions.RevokeAllAsync(currentUser.UserId, RevokeReasons.SignedOutEverywhere, ct);
        await audit.LogAsync(currentUser.UserId, currentUser.OrganizationId, "SignedOutEverywhere", "User", currentUser.UserId.ToString(),
            new { Name = currentUser.DisplayName }, ct);
        return NoContent();
    }

    private async Task<ApplicationUser> CurrentAsync() =>
        await userManager.FindByIdAsync(currentUser.UserId.ToString()) ?? throw new UnauthorizedAccessException();

    private Task<bool> VerifyAuthenticatorCodeAsync(ApplicationUser user, string code) =>
        userManager.VerifyTwoFactorTokenAsync(user, userManager.Options.Tokens.AuthenticatorTokenProvider,
            code.Replace(" ", string.Empty).Replace("-", string.Empty));

    private ObjectResult InvalidCode() =>
        Problem(statusCode: 400, title: "That code didn't work", detail: "Enter the current 6-digit code from your authenticator app.");

    /// <summary>Groups of four, lower case: easier to type into an authenticator by hand.</summary>
    private static string FormatKey(string key)
    {
        var builder = new StringBuilder();
        for (var i = 0; i < key.Length; i += 4)
            builder.Append(key.AsSpan(i, Math.Min(4, key.Length - i))).Append(' ');
        return builder.ToString().TrimEnd().ToLowerInvariant();
    }
}
