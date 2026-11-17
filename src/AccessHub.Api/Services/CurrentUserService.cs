using System.Security.Claims;
using AccessHub.Application.Interfaces;

namespace AccessHub.Api.Services;

/// <summary>The caller, read from the access token's claims. Also the tenant for the DbContext's query filters.</summary>
public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentTenant
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid UserId =>
        Guid.Parse(Principal?.FindFirstValue(AccessHubClaims.Subject) ?? throw new UnauthorizedAccessException());

    public Guid? OrganizationId =>
        Guid.TryParse(Principal?.FindFirstValue(AccessHubClaims.OrganizationId), out var id) ? id : null;

    public bool IsSuperAdmin =>
        Principal?.HasClaim(AccessHubClaims.SuperAdmin, "true") == true;

    public Guid? SessionId =>
        Guid.TryParse(Principal?.FindFirstValue(AccessHubClaims.SessionId), out var id) ? id : null;

    public string DisplayName => Principal?.FindFirstValue(AccessHubClaims.Name) ?? "Someone";

    public bool HasPermission(string permission) =>
        IsSuperAdmin || Principal?.HasClaim(AccessHubClaims.Permission, permission) == true;

    /// <summary>
    /// The permissions in <paramref name="codes"/> the caller does not hold. Granting a role, approving a request
    /// or editing a role may not hand out more than that: nobody can delegate access they don't have.
    /// </summary>
    public IReadOnlyList<string> MissingPermissions(IEnumerable<string> codes) =>
        IsSuperAdmin ? [] : codes.Where(code => !HasPermission(code)).Distinct().Order().ToList();
}
