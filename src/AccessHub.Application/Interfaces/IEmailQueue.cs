namespace AccessHub.Application.Interfaces;

public record EmailMessage(string To, string Subject, string HtmlBody, string TextBody);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

/// <summary>Sends email outside the request (a Hangfire job with retries when Hangfire is enabled).</summary>
public interface IEmailQueue
{
    void Enqueue(EmailMessage message);
}
