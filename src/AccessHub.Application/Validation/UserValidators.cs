using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class CreateUserRequestValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(FieldLengths.Email);
        // Password strength is enforced by ASP.NET Core Identity (IdentityOptions.Password).
        RuleFor(x => x.Password).NotEmpty();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(FieldLengths.PersonName);
        RuleFor(x => x.OrganizationId).NotEmpty();
    }
}

public sealed class UpdateUserRequestValidator : AbstractValidator<UpdateUserRequest>
{
    public UpdateUserRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(FieldLengths.PersonName);
    }
}
