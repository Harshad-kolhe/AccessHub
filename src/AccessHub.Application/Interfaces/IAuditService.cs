namespace AccessHub.Application.Interfaces;

public static class AuditActors
{
    /// <summary>Actor id for changes made by the platform itself, such as the role-expiry job.</summary>
    public static readonly Guid System = Guid.Empty;
}

public interface IAuditService
{
    /// <summary>
    /// Adds an audit event to the current unit of work. It is saved by the same SaveChanges as the change it
    /// describes, so a change is never stored without its audit record (or the other way round).
    /// </summary>
    void Record(Guid actorUserId, Guid? organizationId, string action, string entityType, string? entityId, object? payload = null);

    /// <summary>Records an event and saves immediately, for actions that change nothing else.</summary>
    Task LogAsync(
        Guid actorUserId,
        Guid? organizationId,
        string action,
        string entityType,
        string? entityId,
        object? payload = null,
        CancellationToken cancellationToken = default);
}
