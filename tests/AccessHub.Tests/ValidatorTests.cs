using System.Globalization;
using AccessHub.Application.DTOs;
using AccessHub.Application.Validation;
using AccessHub.Domain.Constants;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace AccessHub.Tests;

public class ValidatorTests
{
    [Fact]
    public void CreateInvoice_ValidRequest_Passes()
    {
        var result = new CreateInvoiceRequestValidator()
            .TestValidate(new CreateInvoiceRequest("INV-100", "Contoso Ltd", 1500.50m));

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-10")]
    [InlineData("10.555")] // more decimals than the decimal(18,2) column can store
    public void CreateInvoice_InvalidAmount_Fails(string amount)
    {
        var request = new CreateInvoiceRequest("INV-100", "Contoso Ltd", decimal.Parse(amount, CultureInfo.InvariantCulture));

        new CreateInvoiceRequestValidator().TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Fact]
    public void CreateInvoice_NumberLongerThanColumn_Fails()
    {
        var request = new CreateInvoiceRequest(new string('9', FieldLengths.InvoiceNumber + 1), "Contoso Ltd", 10m);

        new CreateInvoiceRequestValidator().TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.Number);
    }

    [Fact]
    public void CreateRole_OrganizationScopedPermissions_Pass()
    {
        var request = new CreateRoleRequest("Billing", null, [PermissionCodes.InvoicesRead, PermissionCodes.InvoicesWrite]);

        new CreateRoleRequestValidator().TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateRole_UnknownPermission_Fails()
    {
        var request = new CreateRoleRequest("Billing", null, ["invoices.delete"]);

        var result = new CreateRoleRequestValidator().TestValidate(request);

        result.Errors.Should().ContainSingle()
            .Which.ErrorMessage.Should().Contain("not a known permission");
    }

    [Fact]
    public void CreateRole_PlatformPermission_IsRejected_ToPreventPrivilegeEscalation()
    {
        var request = new CreateRoleRequest("Escalate", null, [PermissionCodes.OrganizationsManage]);

        var result = new CreateRoleRequestValidator().TestValidate(request);

        result.Errors.Should().ContainSingle()
            .Which.ErrorMessage.Should().Contain("reserved for super admins");
    }

    [Fact]
    public void UpdateRole_PlatformPermission_IsRejected()
    {
        var request = new UpdateRoleRequest("Escalate", null, [PermissionCodes.UsersRead, PermissionCodes.OrganizationsManage]);

        new UpdateRoleRequestValidator().TestValidate(request)
            .ShouldHaveValidationErrorFor("PermissionCodes[1]");
    }

    [Theory]
    [InlineData("acme")]
    [InlineData("acme-corp")]
    [InlineData("Acme-2")]
    public void CreateOrganization_ValidSlug_Passes(string slug)
    {
        new CreateOrganizationRequestValidator().TestValidate(new CreateOrganizationRequest("Acme", slug))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("acme corp")]
    [InlineData("-acme")]
    [InlineData("acme-")]
    [InlineData("acme--corp")]
    [InlineData("acme_corp")]
    public void CreateOrganization_InvalidSlug_Fails(string slug)
    {
        new CreateOrganizationRequestValidator().TestValidate(new CreateOrganizationRequest("Acme", slug))
            .ShouldHaveValidationErrorFor(x => x.Slug);
    }

    [Fact]
    public void Register_InvalidEmail_Fails()
    {
        var request = new RegisterRequest("Acme", "Ada Lovelace", "not-an-email", "Passw0rd!");

        new RegisterRequestValidator().TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.Email);
    }
}
