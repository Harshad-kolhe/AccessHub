using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AccessHub.Infrastructure.Persistence.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("Organizations");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Name).HasMaxLength(FieldLengths.OrganizationName).IsRequired();
        builder.Property(o => o.Slug).HasMaxLength(FieldLengths.OrganizationSlug).IsRequired();
        builder.HasIndex(o => o.Slug).IsUnique();
        builder.Property(o => o.Accent).HasMaxLength(FieldLengths.Accent);
    }
}
