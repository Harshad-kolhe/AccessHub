using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class GrantRoleRequestValidator : AbstractValidator<GrantRoleRequest>
{
    public GrantRoleRequestValidator()
    {
        RuleFor(x => x.RoleId).NotEmpty();
        RuleFor(x => x.ExpiresAtUtc).TemporaryAccessWindow();
    }
}

public sealed class CreateAccessRequestRequestValidator : AbstractValidator<CreateAccessRequestRequest>
{
    public CreateAccessRequestRequestValidator()
    {
        RuleFor(x => x.RoleId).NotEmpty();
        RuleFor(x => x.Reason)
            .NotEmpty()
            .MinimumLength(10).WithMessage("Tell the approver why you need access (at least 10 characters).")
            .MaximumLength(FieldLengths.AccessRequestReason);
        RuleFor(x => x.Permission!)
            .Must(code => PermissionCodes.All.Contains(code)).WithMessage("'{PropertyValue}' is not a known permission.")
            .When(x => x.Permission is not null);
    }
}

public sealed class ApproveAccessRequestRequestValidator : AbstractValidator<ApproveAccessRequestRequest>
{
    public ApproveAccessRequestRequestValidator()
    {
        RuleFor(x => x.ExpiresAtUtc).TemporaryAccessWindow();
        RuleFor(x => x.Note).MaximumLength(FieldLengths.AccessRequestReason);
    }
}

public sealed class RejectAccessRequestRequestValidator : AbstractValidator<RejectAccessRequestRequest>
{
    public RejectAccessRequestRequestValidator()
    {
        RuleFor(x => x.Note).MaximumLength(FieldLengths.AccessRequestReason);
    }
}

public sealed class InviteUserRequestValidator : AbstractValidator<InviteUserRequest>
{
    public InviteUserRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(FieldLengths.Email);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(FieldLengths.PersonName);
        RuleFor(x => x.OrganizationId).NotEmpty();
    }
}
