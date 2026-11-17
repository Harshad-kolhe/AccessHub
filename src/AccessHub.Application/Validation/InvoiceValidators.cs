using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using FluentValidation;

namespace AccessHub.Application.Validation;

public sealed class CreateInvoiceRequestValidator : AbstractValidator<CreateInvoiceRequest>
{
    public CreateInvoiceRequestValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(FieldLengths.InvoiceNumber);
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(FieldLengths.CustomerName);
        RuleFor(x => x.Amount)
            .GreaterThan(0)
            .PrecisionScale(18, 2, ignoreTrailingZeros: true); // the column is decimal(18,2); reject values SQL Server would round or overflow
    }
}
