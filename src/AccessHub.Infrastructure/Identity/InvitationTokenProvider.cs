using AccessHub.Domain.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AccessHub.Infrastructure.Identity;

public class InvitationTokenProviderOptions : DataProtectionTokenProviderOptions
{
    public InvitationTokenProviderOptions()
    {
        Name = InvitationTokenProvider.ProviderName;
        TokenLifespan = TimeSpan.FromDays(3);
    }
}

/// <summary>
/// Invitation links live for days; password-reset links (the default provider) only for hours.
/// A separate provider gives each its own lifetime.
/// </summary>
public class InvitationTokenProvider(
    IDataProtectionProvider dataProtectionProvider,
    IOptions<InvitationTokenProviderOptions> options,
    ILogger<DataProtectorTokenProvider<ApplicationUser>> logger)
    : DataProtectorTokenProvider<ApplicationUser>(dataProtectionProvider, options, logger)
{
    public const string ProviderName = "Invitation";
    public const string Purpose = "Invitation";
}
