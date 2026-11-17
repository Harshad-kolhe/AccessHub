using System.Security.Cryptography;
using System.Text;

namespace AccessHub.Infrastructure.Services;

internal static class SecurityStamps
{
    /// <summary>
    /// A short, one-way fingerprint of the security stamp for the access token. Changing the stamp (sign out
    /// everywhere, password reset, role change) makes every token with the old fingerprint fail validation.
    /// </summary>
    public static string Fingerprint(string? securityStamp) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(securityStamp ?? string.Empty)))[..16];

    /// <summary>Refresh tokens are stored as SHA-256 hashes, never in plain text.</summary>
    public static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    /// <summary>256 bits of randomness, URL-safe.</summary>
    public static string NewToken() =>
        Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
