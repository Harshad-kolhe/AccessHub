using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.OrganizationName).NotEmpty().MaximumLength(FieldLengths.OrganizationName);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(FieldLengths.PersonName);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(FieldLengths.Email);
        // Password strength is enforced by ASP.NET Core Identity (IdentityOptions.Password): one source of truth.
        RuleFor(x => x.Password).NotEmpty();
    }
}
