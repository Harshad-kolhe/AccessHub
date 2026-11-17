using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AccessHub.Infrastructure.Persistence.Configurations;

public class AccessRequestConfiguration : IEntityTypeConfiguration<AccessRequest>
{
    public void Configure(EntityTypeBuilder<AccessRequest> builder)
    {
        builder.ToTable("AccessRequests");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.Permission).HasMaxLength(FieldLengths.PermissionCode);
        builder.Property(r => r.Reason).HasMaxLength(FieldLengths.AccessRequestReason).IsRequired();
        builder.Property(r => r.DecisionNote).HasMaxLength(FieldLengths.AccessRequestReason);
        builder.HasIndex(r => new { r.OrganizationId, r.Status, r.CreatedAtUtc });

        builder.HasOne(r => r.Requester).WithMany().HasForeignKey(r => r.RequesterUserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(r => r.Role).WithMany().HasForeignKey(r => r.RoleId).OnDelete(DeleteBehavior.Cascade);
        // NoAction: deleting an organization already cascades through its roles; a second path is not allowed.
        builder.HasOne(r => r.Organization).WithMany().HasForeignKey(r => r.OrganizationId).OnDelete(DeleteBehavior.NoAction);
    }
}
