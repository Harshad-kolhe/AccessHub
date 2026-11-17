using System.Net;
using AccessHub.Application.Interfaces;

namespace AccessHub.Infrastructure.Email;

/// <summary>Plain, inline-styled emails that render well in most clients.</summary>
public static class EmailTemplates
{
    public static EmailMessage Invitation(string to, string fullName, string organizationName, string inviterName, string link, int validDays) =>
        Build(
            to,
            $"{inviterName} invited you to {organizationName} on AccessHub",
            $"Hi {fullName},",
            $"{inviterName} invited you to join {organizationName} on AccessHub. Set a password to activate your account.",
            "Set your password",
            link,
            $"The link works for {validDays} days. If you weren't expecting this invitation, you can ignore this email.");

    public static EmailMessage PasswordReset(string to, string fullName, string link) =>
        Build(
            to,
            "Reset your AccessHub password",
            $"Hi {fullName},",
            "Someone asked to reset the password for your AccessHub account. If it was you, choose a new password below.",
            "Choose a new password",
            link,
            "The link works for 2 hours. If you didn't ask for this, you can ignore this email; your password stays the same.");

    private static EmailMessage Build(string to, string subject, string greeting, string body, string action, string link, string footer)
    {
        var html = $"""
            <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#14202e">
              <p style="font-size:18px;font-weight:600;margin:0 0 16px">AccessHub</p>
              <p>{WebUtility.HtmlEncode(greeting)}</p>
              <p>{WebUtility.HtmlEncode(body)}</p>
              <p style="margin:28px 0">
                <a href="{WebUtility.HtmlEncode(link)}" style="background:#2448d8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">{WebUtility.HtmlEncode(action)}</a>
              </p>
              <p style="color:#586477;font-size:13px">{WebUtility.HtmlEncode(footer)}</p>
            </div>
            """;
        var text = $"{greeting}\n\n{body}\n\n{action}: {link}\n\n{footer}";
        return new EmailMessage(to, subject, html, text);
    }
}
