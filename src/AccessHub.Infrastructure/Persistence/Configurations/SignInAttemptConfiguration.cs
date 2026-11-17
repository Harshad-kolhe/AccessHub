using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AccessHub.Infrastructure.Persistence.Configurations;

public class SignInAttemptConfiguration : IEntityTypeConfiguration<SignInAttempt>
{
    public void Configure(EntityTypeBuilder<SignInAttempt> builder)
    {
        builder.ToTable("SignInAttempts");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Email).HasMaxLength(FieldLengths.Email).IsRequired();
        builder.Property(a => a.FailureReason).HasMaxLength(50);
        builder.Property(a => a.IpAddress).HasMaxLength(64);
        builder.Property(a => a.UserAgent).HasMaxLength(256);
        builder.HasIndex(a => new { a.OrganizationId, a.OccurredAtUtc });
    }
}
