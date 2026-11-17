namespace AccessHub.Application.Interfaces;

/// <summary>Claim types in AccessHub access tokens (short names; inbound claim mapping is off).</summary>
public static class AccessHubClaims
{
    public const string Subject = "sub";
    public const string Name = "name";
    public const string Email = "email";
    public const string OrganizationId = "org_id";
    public const string SuperAdmin = "is_super_admin";
    public const string Permission = "permission";
    /// <summary>The session (refresh-token family) the token belongs to.</summary>
    public const string SessionId = "sid";
    /// <summary>Fingerprint of the user's security stamp when the token was issued.</summary>
    public const string StampFingerprint = "sst";
    /// <summary>Realtime tickets only: the holder may approve access requests, so it hears about new ones.</summary>
    public const string CanApprove = "can_approve";
}
