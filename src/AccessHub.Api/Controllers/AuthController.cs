using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using AccessHub.Api.Extensions;
using AccessHub.Application.DTOs;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Email;
using AccessHub.Infrastructure.Identity;
using AccessHub.Infrastructure.Seed;
using AccessHub.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AccessHub.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    ITokenService tokens,
    ISessionService sessions,
    IPermissionService permissionService,
    IAuditService audit,
    IEmailQueue emails,
    IAccessHubDbContext db,
    IAuthenticationSchemeProvider schemes,
    IMemoryCache cache,
    IConfiguration configuration,
    TimeProvider clock) : ControllerBase
{
    public static readonly string[] ExternalProviders = ["Google", "Microsoft"];

    private string WebBaseUrl => (configuration["App:WebBaseUrl"] ?? "http://localhost:3000").TrimEnd('/');

    // ----- Password sign-in, with an optional two-factor step -----

    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var client = HttpContext.GetClientInfo();
        var user = await FindByEmailWithOrganizationAsync(request.Email, ct);

        if (user is null || user.PasswordHash is null)
        {
            await RecordAttemptAsync(user, request.Email, false, SignInFailureReasons.InvalidCredentials, client, ct);
            return InvalidCredentials();
        }
        if (!user.IsActive)
        {
            await RecordAttemptAsync(user, request.Email, false, SignInFailureReasons.Inactive, client, ct);
            return InvalidCredentials();
        }

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            await RecordAttemptAsync(user, request.Email, false, SignInFailureReasons.LockedOut, client, ct);
            return LockedOut(user);
        }
        if (!result.Succeeded)
        {
            await RecordAttemptAsync(user, request.Email, false, SignInFailureReasons.InvalidCredentials, client, ct);
            return InvalidCredentials();
        }

        if (user.TwoFactorEnabled)
            return Ok(new AuthResponse(true, tokens.CreateTwoFactorChallenge(user.Id).Token, null, null));

        return await CompleteSignInAsync(user, client, ct);
    }

    [HttpPost("login/two-factor")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> LoginTwoFactor([FromBody] TwoFactorLoginRequest request, CancellationToken ct)
    {
        var client = HttpContext.GetClientInfo();
        var userId = tokens.ReadTwoFactorChallenge(request.ChallengeToken);
        if (userId is null)
            return Problem(statusCode: 401, title: "Sign-in expired", detail: "That took too long. Enter your email and password again.");

        var user = await userManager.Users.Include(u => u.Organization).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || !user.IsActive)
            return InvalidCredentials();
        if (await userManager.IsLockedOutAsync(user))
        {
            await RecordAttemptAsync(user, user.Email!, false, SignInFailureReasons.LockedOut, client, ct);
            return LockedOut(user);
        }

        var valid = request.IsRecoveryCode
            ? (await userManager.RedeemTwoFactorRecoveryCodeAsync(user, request.Code.Trim())).Succeeded
            : await userManager.VerifyTwoFactorTokenAsync(
                user, userManager.Options.Tokens.AuthenticatorTokenProvider, request.Code.Replace(" ", string.Empty).Replace("-", string.Empty));

        if (!valid)
        {
            await userManager.AccessFailedAsync(user);
            await RecordAttemptAsync(user, user.Email!, false, SignInFailureReasons.InvalidTwoFactorCode, client, ct);
            if (await userManager.IsLockedOutAsync(user))
                return LockedOut(user);
            return Problem(statusCode: 401, title: "That code didn't work", detail: "Check the code in your authenticator app and try again.");
        }

        await userManager.ResetAccessFailedCountAsync(user);
        return await CompleteSignInAsync(user, client, ct);
    }

    // ----- Sessions -----

    [HttpPost("refresh")]
    [EnableRateLimiting(RateLimitPolicies.Refresh)]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var refreshed = await sessions.RefreshAsync(request.RefreshToken, HttpContext.GetClientInfo(), ct);
        if (refreshed is null)
            return Problem(statusCode: 401, title: "Session ended", detail: "Sign in again to continue.");

        var me = await BuildCurrentUserAsync(refreshed.User, refreshed.Tokens.SessionId, ct);
        return Ok(new AuthResponse(false, null, refreshed.Tokens, me));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request, CancellationToken ct)
    {
        await sessions.SignOutAsync(request.RefreshToken, ct);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(AccessHubClaims.Subject)!);
        var user = await userManager.Users.Include(u => u.Organization).FirstAsync(u => u.Id == userId, ct);
        var sessionId = Guid.TryParse(User.FindFirstValue(AccessHubClaims.SessionId), out var sid) ? sid : (Guid?)null;
        return Ok(await BuildCurrentUserAsync(user, sessionId, ct));
    }

    // ----- Self-service registration and recovery -----

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        if (await userManager.FindByEmailAsync(request.Email) is not null)
            return Problem(statusCode: 409, title: "Email already in use", detail: "An account with this email already exists. Sign in instead.");

        var now = clock.GetUtcNow().UtcDateTime;
        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = request.OrganizationName,
            Slug = await GenerateUniqueSlugAsync(request.OrganizationName, ct),
            IsActive = true,
            CreatedAtUtc = now,
        };
        db.Organizations.Add(org);

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true,
            FullName = request.FullName,
            OrganizationId = org.Id,
            IsActive = true,
            CreatedAtUtc = now,
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
            return this.IdentityProblem(createResult);

        var permissions = await db.Permissions.ToListAsync(ct);
        var adminRole = new Role { Id = Guid.NewGuid(), OrganizationId = org.Id, Name = "OrgAdmin", Description = "Full organization administrator", CreatedAtUtc = now };
        db.OrgRoles.Add(adminRole);
        foreach (var permission in permissions.Where(p => PermissionCodes.OrganizationScoped.Contains(p.Code)))
            db.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = permission.Id });
        db.OrgUserRoles.Add(new UserRole { UserId = user.Id, RoleId = adminRole.Id, AssignedAtUtc = now });

        audit.Record(user.Id, org.Id, "Created", "Organization", org.Id.ToString(), new { org.Name, org.Slug });
        await db.SaveChangesAsync(ct);

        user.Organization = org;
        return await CompleteSignInAsync(user, HttpContext.GetClientInfo(), ct);
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        // Shared demo accounts never get reset links (nobody may change their password).
        if (user is { IsActive: true } && !DemoAccounts.IsProtected(configuration, user.Email) && await userManager.HasPasswordAsync(user))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var link = $"{WebBaseUrl}/reset-password?email={Uri.EscapeDataString(user.Email!)}&token={Uri.EscapeDataString(token)}";
            emails.Enqueue(EmailTemplates.PasswordReset(user.Email!, user.FullName, link));
        }

        // The same answer whether or not the account exists, so this endpoint can't be used to find accounts.
        return Accepted();
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null || !user.IsActive)
            return InvalidLink("reset");
        if (DemoAccounts.IsProtected(configuration, user.Email))
            return this.DemoAccountProtected("changing the password");

        var result = await userManager.ResetPasswordAsync(user, request.Token, request.Password);
        if (!result.Succeeded)
            return result.Errors.Any(e => e.Code == "InvalidToken") ? InvalidLink("reset") : this.IdentityProblem(result);

        await userManager.SetLockoutEndDateAsync(user, null);
        await userManager.ResetAccessFailedCountAsync(user);
        await sessions.RevokeAllAsync(user.Id, RevokeReasons.PasswordReset, ct);
        await audit.LogAsync(user.Id, user.OrganizationId, "PasswordReset", "User", user.Id.ToString(), new { user.Email, user.FullName }, ct);
        return NoContent();
    }

    [HttpPost("accept-invite")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> AcceptInvite([FromBody] AcceptInviteRequest request, CancellationToken ct)
    {
        var user = await userManager.Users.Include(u => u.Organization).FirstOrDefaultAsync(u => u.Id == request.UserId, ct);
        if (user is null || !user.IsActive || await userManager.HasPasswordAsync(user))
            return InvalidLink("invitation");

        var valid = await userManager.VerifyUserTokenAsync(user, InvitationTokenProvider.ProviderName, InvitationTokenProvider.Purpose, request.Token);
        if (!valid)
            return InvalidLink("invitation");

        // Adding the password also rotates the security stamp, which makes the invitation link single-use.
        var result = await userManager.AddPasswordAsync(user, request.Password);
        if (!result.Succeeded)
            return this.IdentityProblem(result);

        user.EmailConfirmed = true;
        await userManager.UpdateAsync(user);
        audit.Record(user.Id, user.OrganizationId, "AcceptedInvitation", "User", user.Id.ToString(), new { user.Email, user.FullName });
        await db.SaveChangesAsync(ct);

        return await CompleteSignInAsync(user, HttpContext.GetClientInfo(), ct);
    }

    // ----- External providers (Google, Microsoft) -----

    [HttpGet("providers")]
    public async Task<ActionResult<IEnumerable<ExternalProviderDto>>> Providers()
    {
        var configured = (await schemes.GetAllSchemesAsync())
            .Where(scheme => ExternalProviders.Contains(scheme.Name))
            .Select(scheme => new ExternalProviderDto(scheme.Name, scheme.DisplayName ?? scheme.Name));
        return Ok(configured);
    }

    /// <summary>The browser comes here directly (not through Next.js) and is redirected to the provider.</summary>
    [HttpGet("external/{provider}")]
    public async Task<IActionResult> External(string provider)
    {
        if (!ExternalProviders.Contains(provider) || await schemes.GetSchemeAsync(provider) is null)
            return NotFound();

        var properties = new AuthenticationProperties { RedirectUri = Url.Action(nameof(ExternalCallback)) };
        return Challenge(properties, provider);
    }

    [HttpGet("external/callback")]
    public async Task<IActionResult> ExternalCallback()
    {
        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ExternalScheme);
        await HttpContext.SignOutAsync(IdentityConstants.ExternalScheme);

        var principal = result.Principal;
        var provider = principal?.Identity?.AuthenticationType;
        var providerKey = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!result.Succeeded || provider is null || providerKey is null)
            return Redirect($"{WebBaseUrl}/login?error=external");

        var user = await userManager.FindByLoginAsync(provider, providerKey);
        if (user is null && principal!.FindFirstValue(ClaimTypes.Email) is { } email)
        {
            // Only existing (or invited) accounts can sign in with a provider; nobody gets a tenant this way.
            user = await userManager.FindByEmailAsync(email);
            if (user is not null)
                await userManager.AddLoginAsync(user, new UserLoginInfo(provider, providerKey, provider));
        }
        if (user is null || !user.IsActive)
            return Redirect($"{WebBaseUrl}/login?error=external_no_account");

        // Hand the browser a one-time code rather than tokens: Next.js exchanges it server-to-server.
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        cache.Set(ExternalCodeKey(code), user.Id, TimeSpan.FromSeconds(60));
        return Redirect($"{WebBaseUrl}/auth/external?code={code}");
    }

    [HttpPost("external/exchange")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<ActionResult<AuthResponse>> ExternalExchange([FromBody] ExternalExchangeRequest request, CancellationToken ct)
    {
        if (!cache.TryGetValue(ExternalCodeKey(request.Code), out Guid userId))
            return Problem(statusCode: 401, title: "Sign-in expired", detail: "Start the sign-in again.");
        cache.Remove(ExternalCodeKey(request.Code));

        var user = await userManager.Users.Include(u => u.Organization).FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || !user.IsActive)
            return InvalidCredentials();
        if (user.TwoFactorEnabled)
            return Ok(new AuthResponse(true, tokens.CreateTwoFactorChallenge(user.Id).Token, null, null));

        return await CompleteSignInAsync(user, HttpContext.GetClientInfo(), ct);
    }

    // ----- Helpers -----

    private async Task<ActionResult<AuthResponse>> CompleteSignInAsync(ApplicationUser user, ClientInfo client, CancellationToken ct)
    {
        var session = await sessions.StartAsync(user, client, ct);
        await RecordAttemptAsync(user, user.Email!, true, null, client, ct);
        var me = await BuildCurrentUserAsync(user, session.SessionId, ct);
        return Ok(new AuthResponse(false, null, session, me));
    }

    private async Task<CurrentUserDto> BuildCurrentUserAsync(ApplicationUser user, Guid? sessionId, CancellationToken ct)
    {
        var organization = user.Organization;
        if (organization is null && user.OrganizationId.HasValue)
            organization = await db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == user.OrganizationId, ct);

        var permissions = await permissionService.GetUserPermissionsAsync(user.Id, ct);
        return new CurrentUserDto(
            user.Id,
            user.Email!,
            user.FullName,
            user.OrganizationId,
            organization?.Name,
            organization?.Accent,
            user.IsSuperAdmin,
            user.TwoFactorEnabled,
            sessionId,
            permissions);
    }

    private Task<ApplicationUser?> FindByEmailWithOrganizationAsync(string email, CancellationToken ct)
    {
        var normalized = userManager.NormalizeEmail(email);
        return userManager.Users.Include(u => u.Organization).FirstOrDefaultAsync(u => u.NormalizedEmail == normalized, ct);
    }

    private async Task RecordAttemptAsync(ApplicationUser? user, string email, bool succeeded, string? reason, ClientInfo client, CancellationToken ct)
    {
        db.SignInAttempts.Add(new SignInAttempt
        {
            Id = Guid.NewGuid(),
            UserId = user?.Id,
            OrganizationId = user?.OrganizationId,
            Email = email.Length > FieldLengths.Email ? email[..FieldLengths.Email] : email,
            Succeeded = succeeded,
            FailureReason = reason,
            IpAddress = client.IpAddress,
            UserAgent = client.UserAgent is { Length: > 256 } agent ? agent[..256] : client.UserAgent,
            OccurredAtUtc = clock.GetUtcNow().UtcDateTime,
        });
        await db.SaveChangesAsync(ct);
    }

    private ObjectResult InvalidCredentials() =>
        Problem(statusCode: 401, title: "Sign-in failed", detail: "That email and password don't match an active account.");

    private ObjectResult LockedOut(ApplicationUser user)
    {
        var minutes = user.LockoutEnd is { } end
            ? Math.Max(1, (int)Math.Ceiling((end - clock.GetUtcNow()).TotalMinutes))
            : 15;
        return Problem(statusCode: 423, title: "Account locked",
            detail: $"Too many failed attempts. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}, or reset your password.");
    }

    private ObjectResult InvalidLink(string kind) =>
        Problem(statusCode: 400, title: $"This {kind} link doesn't work",
            detail: $"The link has expired or was already used. Ask for a new {kind} link.");

    private static string ExternalCodeKey(string code) => $"external-code:{code}";

    private async Task<string> GenerateUniqueSlugAsync(string name, CancellationToken ct)
    {
        var baseSlug = Regex.Replace(name.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrEmpty(baseSlug))
            baseSlug = "org";

        var slug = baseSlug;
        while (await db.Organizations.AnyAsync(o => o.Slug == slug, ct))
            slug = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";
        return slug;
    }
}
