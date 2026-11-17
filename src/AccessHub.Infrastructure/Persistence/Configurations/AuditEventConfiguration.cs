using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AccessHub.Infrastructure.Persistence.Configurations;

public class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("AuditEvents");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Action).HasMaxLength(FieldLengths.AuditAction).IsRequired();
        builder.Property(a => a.EntityType).HasMaxLength(FieldLengths.AuditEntityType).IsRequired();
        builder.HasIndex(a => a.CreatedAtUtc);
        builder.HasOne(a => a.Organization).WithMany(o => o.AuditEvents).HasForeignKey(a => a.OrganizationId);
    }
}
