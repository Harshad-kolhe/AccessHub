using AccessHub.Application.Interfaces;
using Hangfire;
using Microsoft.Extensions.Logging;

namespace AccessHub.Infrastructure.Email;

/// <summary>Sends each email as a Hangfire job, so a slow or failing SMTP server never blocks a request and retries.</summary>
public class HangfireEmailQueue(IBackgroundJobClient jobs) : IEmailQueue
{
    public void Enqueue(EmailMessage message) =>
        jobs.Enqueue<IEmailSender>(sender => sender.SendAsync(message, CancellationToken.None));
}

/// <summary>Used when Hangfire is switched off (tests): sends in the background without retries.</summary>
public class InlineEmailQueue(IEmailSender sender, ILogger<InlineEmailQueue> logger) : IEmailQueue
{
    public void Enqueue(EmailMessage message) =>
        _ = Task.Run(async () =>
        {
            try
            {
                await sender.SendAsync(message);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Could not send email {Subject} to {To}", message.Subject, message.To);
            }
        });
}
