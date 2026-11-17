using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace AccessHub.Api.Extensions;

/// <summary>
/// Turns a unique-index violation that slipped past the controllers' own checks (two requests racing to create
/// the same slug or email) into a 409 problem instead of a 500.
/// </summary>
internal sealed class DuplicateKeyExceptionHandler(IProblemDetailsService problems, ILogger<DuplicateKeyExceptionHandler> logger) : IExceptionHandler
{
    private const int UniqueIndexViolation = 2601;
    private const int UniqueConstraintViolation = 2627;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not DbUpdateException { InnerException: SqlException { Number: UniqueIndexViolation or UniqueConstraintViolation } })
            return false;

        logger.LogWarning(exception, "Duplicate key on {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        httpContext.Response.StatusCode = StatusCodes.Status409Conflict;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Already exists",
                Detail = "Something with the same unique value already exists. Refresh and try again.",
            },
        });
    }
}
