namespace AccessHub.Infrastructure.Email;

public class EmailOptions
{
    public string From { get; set; } = "AccessHub <no-reply@accesshub.local>";
    public SmtpOptions Smtp { get; set; } = new();

    /// <summary>Without an SMTP host, emails are written to the log instead (links stay usable in development).</summary>
    public bool SmtpConfigured => !string.IsNullOrWhiteSpace(Smtp.Host);
}

public class SmtpOptions
{
    public string? Host { get; set; }
    public int Port { get; set; } = 2525;
    public bool UseSsl { get; set; }
    public string? UserName { get; set; }
    public string? Password { get; set; }
}
