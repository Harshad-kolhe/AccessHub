using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class CreateOrganizationRequestValidator : AbstractValidator<CreateOrganizationRequest>
{
    public CreateOrganizationRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(FieldLengths.OrganizationName);
        RuleFor(x => x.Slug).ValidSlug();
        RuleFor(x => x.Accent).KnownAccent();
    }
}

public sealed class UpdateOrganizationRequestValidator : AbstractValidator<UpdateOrganizationRequest>
{
    public UpdateOrganizationRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(FieldLengths.OrganizationName);
        RuleFor(x => x.Slug).ValidSlug();
        RuleFor(x => x.Accent).KnownAccent();
    }
}
