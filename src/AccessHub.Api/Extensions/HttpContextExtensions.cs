using AccessHub.Application.Interfaces;

namespace AccessHub.Api.Extensions;

public static class HttpContextExtensions
{
    /// <summary>
    /// The browser's address and user agent. Behind the Next.js server they arrive as X-Forwarded-For (applied by
    /// the forwarded-headers middleware) and X-Forwarded-User-Agent.
    /// </summary>
    public static ClientInfo GetClientInfo(this HttpContext context)
    {
        var userAgent = context.Request.Headers["X-Forwarded-User-Agent"].ToString();
        if (string.IsNullOrWhiteSpace(userAgent))
            userAgent = context.Request.Headers.UserAgent.ToString();

        return new ClientInfo(context.Connection.RemoteIpAddress?.ToString(), string.IsNullOrWhiteSpace(userAgent) ? null : userAgent);
    }
}
