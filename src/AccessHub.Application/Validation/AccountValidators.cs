using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(FieldLengths.Email);
    }
}

public sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(FieldLengths.Email);
        RuleFor(x => x.Token).NotEmpty();
        // Password strength is enforced by ASP.NET Core Identity (IdentityOptions.Password).
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class AcceptInviteRequestValidator : AbstractValidator<AcceptInviteRequest>
{
    public AcceptInviteRequestValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class TwoFactorLoginRequestValidator : AbstractValidator<TwoFactorLoginRequest>
{
    public TwoFactorLoginRequestValidator()
    {
        RuleFor(x => x.ChallengeToken).NotEmpty();
        RuleFor(x => x.Code).NotEmpty().MaximumLength(32);
    }
}

public sealed class TwoFactorCodeRequestValidator : AbstractValidator<TwoFactorCodeRequest>
{
    public TwoFactorCodeRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(32);
    }
}
