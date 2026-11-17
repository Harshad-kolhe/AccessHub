using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace AccessHub.Api.Validation;

/// <summary>
/// Runs the FluentValidation validator registered for each action argument (validators live in the
/// Application layer, next to the request DTOs). Failures short-circuit the action with the same
/// 400 ValidationProblemDetails (RFC 9457) response that [ApiController] returns for model-binding errors.
/// </summary>
/// <remarks>
/// Used instead of FluentValidation.AspNetCore's auto-validation, which is deprecated and cannot run async rules.
/// </remarks>
public sealed class FluentValidationFilter(IOptions<ApiBehaviorOptions> apiBehaviorOptions) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null)
                continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (context.HttpContext.RequestServices.GetService(validatorType) is not IValidator validator)
                continue;

            var result = await validator.ValidateAsync(
                new ValidationContext<object>(argument), context.HttpContext.RequestAborted);

            foreach (var error in result.Errors)
                context.ModelState.AddModelError(error.PropertyName, error.ErrorMessage);
        }

        if (!context.ModelState.IsValid)
        {
            context.Result = apiBehaviorOptions.Value.InvalidModelStateResponseFactory(context);
            return;
        }

        await next();
    }
}
