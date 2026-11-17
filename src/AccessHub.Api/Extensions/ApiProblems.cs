using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AccessHub.Api.Extensions;

public static class RateLimitPolicies
{
    /// <summary>Sign-in and account-recovery endpoints, limited per client address.</summary>
    public const string Auth = "auth";

    /// <summary>Token refresh: more generous, since every open tab refreshes.</summary>
    public const string Refresh = "refresh";
}

public static class ApiProblems
{
    /// <summary>
    /// Identity failures (weak password, duplicate email...) as a 400 ValidationProblemDetails, the same shape
    /// FluentValidation errors have, so the web app reads one format.
    /// </summary>
    public static ActionResult IdentityProblem(this ControllerBase controller, IdentityResult result)
    {
        var errors = result.Errors
            .GroupBy(error => FieldFor(error.Code))
            .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray());
        return controller.ValidationProblem(new ValidationProblemDetails(errors));
    }

    /// <summary>403 for an attempt to delegate permissions the caller does not hold.</summary>
    public static ObjectResult CannotDelegate(this ControllerBase controller, string roleName, IReadOnlyList<string> missing) =>
        controller.Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "You can't hand out access you don't have",
            detail: $"{roleName} includes {string.Join(", ", missing)}, which you don't have yourself.");

    /// <summary>403 for a change that would lock other visitors out of a shared demo account.</summary>
    public static ObjectResult DemoAccountProtected(this ControllerBase controller, string what) =>
        controller.Problem(
            statusCode: StatusCodes.Status403Forbidden,
            title: "This is a shared demo account",
            detail: $"Every visitor signs in with it, so {what} is turned off. Create your own organization to try it.");

    private static string FieldFor(string code) => code switch
    {
        _ when code.StartsWith("Password", StringComparison.Ordinal) => "Password",
        "DuplicateEmail" or "InvalidEmail" or "DuplicateUserName" or "InvalidUserName" => "Email",
        _ => "General",
    };
}
