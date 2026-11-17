using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AccessHub.Infrastructure.Persistence.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.ToTable("Users");
        builder.Property(u => u.FullName).HasMaxLength(FieldLengths.PersonName).IsRequired();
        builder.HasOne(u => u.Organization).WithMany(o => o.Users).HasForeignKey(u => u.OrganizationId);
    }
}
