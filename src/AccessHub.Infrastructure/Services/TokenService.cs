using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AccessHub.Infrastructure.Services;

public class TokenService(IConfiguration configuration, IPermissionService permissionService, TimeProvider clock) : ITokenService
{
    public const string TwoFactorAudience = "AccessHub.TwoFactor";
    public const string RealtimeAudience = "AccessHub.Realtime";

    private string Issuer => configuration["Jwt:Issuer"] ?? "AccessHub";
    private string WebAudience => configuration["Jwt:Audience"] ?? "AccessHub.Web";
    private int AccessTokenMinutes => configuration.GetValue("Jwt:AccessTokenMinutes", 15);
    private SymmetricSecurityKey SigningKey => new(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!));

    public async Task<IssuedToken> CreateAccessTokenAsync(ApplicationUser user, Guid sessionId, CancellationToken cancellationToken = default)
    {
        var permissions = await permissionService.GetUserPermissionsAsync(user.Id, cancellationToken);
        var claims = new List<Claim>
        {
            new(AccessHubClaims.Subject, user.Id.ToString()),
            new(AccessHubClaims.Email, user.Email ?? string.Empty),
            new(AccessHubClaims.Name, user.FullName),
            new(AccessHubClaims.SuperAdmin, user.IsSuperAdmin.ToString().ToLowerInvariant()),
            new(AccessHubClaims.SessionId, sessionId.ToString()),
            new(AccessHubClaims.StampFingerprint, SecurityStamps.Fingerprint(user.SecurityStamp)),
        };

        if (user.OrganizationId.HasValue)
            claims.Add(new Claim(AccessHubClaims.OrganizationId, user.OrganizationId.Value.ToString()));

        claims.AddRange(permissions.Select(permission => new Claim(AccessHubClaims.Permission, permission)));

        var expires = Now.AddMinutes(AccessTokenMinutes);
        return new IssuedToken(Write(claims, WebAudience, expires), expires);
    }

    public IssuedToken CreateTwoFactorChallenge(Guid userId)
    {
        var expires = Now.AddMinutes(5);
        return new IssuedToken(Write([new Claim(AccessHubClaims.Subject, userId.ToString())], TwoFactorAudience, expires), expires);
    }

    public Guid? ReadTwoFactorChallenge(string challengeToken)
    {
        try
        {
            var principal = new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(challengeToken, new TokenValidationParameters
            {
                ValidIssuer = Issuer,
                ValidAudience = TwoFactorAudience,
                IssuerSigningKey = SigningKey,
                ClockSkew = TimeSpan.FromSeconds(30),
            }, out _);
            return Guid.TryParse(principal.FindFirstValue(AccessHubClaims.Subject), out var userId) ? userId : null;
        }
        catch (SecurityTokenException)
        {
            return null;
        }
        catch (ArgumentException)
        {
            return null; // not a JWT at all
        }
    }

    public IssuedToken CreateRealtimeTicket(Guid userId, Guid? organizationId, bool isSuperAdmin, bool canApprove)
    {
        var claims = new List<Claim>
        {
            new(AccessHubClaims.Subject, userId.ToString()),
            new(AccessHubClaims.SuperAdmin, isSuperAdmin.ToString().ToLowerInvariant()),
            new(AccessHubClaims.CanApprove, canApprove.ToString().ToLowerInvariant()),
        };
        if (organizationId.HasValue)
            claims.Add(new Claim(AccessHubClaims.OrganizationId, organizationId.Value.ToString()));

        var expires = Now.AddMinutes(2);
        return new IssuedToken(Write(claims, RealtimeAudience, expires), expires);
    }

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private string Write(IEnumerable<Claim> claims, string audience, DateTime expires)
    {
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: audience,
            claims: claims,
            notBefore: Now,
            expires: expires,
            signingCredentials: new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
