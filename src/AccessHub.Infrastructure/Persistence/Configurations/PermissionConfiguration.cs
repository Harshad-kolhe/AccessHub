using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AccessHub.Infrastructure.Persistence.Configurations;

public class PermissionConfiguration : IEntityTypeConfiguration<Permission>
{
    public void Configure(EntityTypeBuilder<Permission> builder)
    {
        builder.ToTable("Permissions");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Code).HasMaxLength(FieldLengths.PermissionCode).IsRequired();
        builder.Property(p => p.DisplayName).HasMaxLength(FieldLengths.PermissionDisplayName).IsRequired();
        builder.HasIndex(p => p.Code).IsUnique();
    }
}
