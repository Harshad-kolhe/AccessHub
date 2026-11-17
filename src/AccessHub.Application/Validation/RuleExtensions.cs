using System.Text.RegularExpressions;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

/// <summary>Rules shared by more than one request validator.</summary>
internal static partial class RuleExtensions
{
    /// <summary>Letters and digits separated by single hyphens, e.g. "acme" or "acme-corp" (stored lower-case).</summary>
    [GeneratedRegex("^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$")]
    private static partial Regex SlugPattern();

    public static IRuleBuilderOptions<T, string> ValidSlug<T>(this IRuleBuilder<T, string> rule) =>
        rule.NotEmpty()
            .MaximumLength(FieldLengths.OrganizationSlug)
            .Matches(SlugPattern())
            .WithMessage("'{PropertyName}' may only contain letters, numbers and single hyphens, e.g. 'acme-corp'.");

    /// <summary>Optional expiry for temporary access: in the future and at most a year away.</summary>
    public static IRuleBuilderOptions<T, DateTime?> TemporaryAccessWindow<T>(this IRuleBuilder<T, DateTime?> rule) =>
        rule.Must(expires => expires is null || (expires > DateTime.UtcNow && expires <= DateTime.UtcNow.AddYears(1)))
            .WithMessage("Temporary access must end in the future and within a year.");

    /// <summary>An organization accent must be one of the presets (or empty for the default).</summary>
    public static IRuleBuilderOptions<T, string?> KnownAccent<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(accent => accent is null || Accents.All.Contains(accent))
            .WithMessage($"Accent must be one of: {string.Join(", ", Accents.All)}.");

    /// <summary>
    /// The permission must exist and be grantable by an organization role. Rejecting the platform-wide
    /// organizations.manage here stops an org admin from escalating to cross-tenant access via a custom role.
    /// </summary>
    public static IRuleBuilderOptions<T, string> GrantableByOrganizationRole<T>(this IRuleBuilder<T, string> rule) =>
        rule.Must(code => PermissionCodes.All.Contains(code))
            .WithMessage("'{PropertyValue}' is not a known permission.")
            .Must(code => !PermissionCodes.All.Contains(code) || PermissionCodes.OrganizationScoped.Contains(code))
            .WithMessage("'{PropertyValue}' is a platform permission reserved for super admins; organization roles cannot grant it.");
}
