using AccessHub.Application.Interfaces;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace AccessHub.Infrastructure.Email;

/// <summary>Sends through SMTP with MailKit (smtp4dev or Papercut locally, a real provider in production).</summary>
public class SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var settings = options.Value;
        var mime = new MimeMessage();
        mime.From.Add(MailboxAddress.Parse(settings.From));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        mime.Body = new BodyBuilder { HtmlBody = message.HtmlBody, TextBody = message.TextBody }.ToMessageBody();

        using var client = new SmtpClient();
        // Only registered when Email:Smtp:Host is set (see EmailOptions.SmtpConfigured).
        await client.ConnectAsync(
            settings.Smtp.Host!,
            settings.Smtp.Port,
            settings.Smtp.UseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None,
            cancellationToken);
        if (!string.IsNullOrEmpty(settings.Smtp.UserName))
            await client.AuthenticateAsync(settings.Smtp.UserName, settings.Smtp.Password ?? string.Empty, cancellationToken);
        await client.SendAsync(new SendRequest(mime), cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);

        logger.LogInformation("Sent email {Subject} to {To}", message.Subject, message.To);
    }
}

/// <summary>Development fallback when no SMTP server is configured: the email (and its links) goes to the log.</summary>
public class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Email (no SMTP configured) to {To}: {Subject}{NewLine}{Body}", message.To, message.Subject, Environment.NewLine, message.TextBody);
        return Task.CompletedTask;
    }
}
