namespace AccessHub.Application.Interfaces;

/// <summary>
/// Who the current request acts for. The DbContext's tenant query filters use it, so organization data
/// stays invisible across tenants even if a query forgets its own <c>OrganizationId</c> check.
/// </summary>
public interface ICurrentTenant
{
    /// <summary>The caller's organization; null for super admins and unauthenticated requests.</summary>
    Guid? OrganizationId { get; }

    /// <summary>Super admins operate across every organization, so the filters do not apply to them.</summary>
    bool IsSuperAdmin { get; }
}
