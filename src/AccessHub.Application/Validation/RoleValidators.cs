using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class CreateRoleRequestValidator : AbstractValidator<CreateRoleRequest>
{
    public CreateRoleRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(FieldLengths.RoleName);
        RuleFor(x => x.PermissionCodes).NotNull();
        RuleForEach(x => x.PermissionCodes).GrantableByOrganizationRole();
    }
}

public sealed class UpdateRoleRequestValidator : AbstractValidator<UpdateRoleRequest>
{
    public UpdateRoleRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(FieldLengths.RoleName);
        RuleFor(x => x.PermissionCodes).NotNull();
        RuleForEach(x => x.PermissionCodes).GrantableByOrganizationRole();
    }
}
