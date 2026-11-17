using System.Net;
using System.Net.Http.Json;
using AccessHub.Api.Controllers;
using AccessHub.Application.DTOs;
using AccessHub.Domain.Constants;
using AccessHub.Infrastructure.Jobs;
using AccessHub.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;
using static AccessHub.IntegrationTests.ApiClient;

namespace AccessHub.IntegrationTests;

/// <summary>End-to-end checks of the security features, through HTTP, against SQL Server.</summary>
[Collection(ApiCollection.Name)]
public class SecurityTests(ApiFactory factory)
{
    [Fact]
    public async Task Readiness_probe_checks_the_database()
    {
        var response = await factory.CreateClient().GetAsync("/health/ready");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadAsStringAsync()).Should().Contain("\"database\"").And.Contain("Healthy");
    }

    [Fact]
    public async Task Signing_in_returns_a_token_pair_and_the_user()
    {
        var auth = await factory.SignInAsync(AdminEmail, AdminPassword);

        auth.User!.Permissions.Should().BeEquivalentTo(PermissionCodes.OrganizationScoped);
        var me = await (await factory.As(auth.Tokens!.AccessToken).GetAsync("/api/auth/me")).ReadAsync<CurrentUserDto>();
        me.Email.Should().Be(AdminEmail);
        me.SessionId.Should().Be(auth.Tokens.SessionId);
    }

    [Fact]
    public async Task Reusing_a_rotated_refresh_token_revokes_the_whole_session()
    {
        var first = (await factory.SignInAsync(ViewerEmail, ViewerPassword)).Tokens!;
        var client = factory.CreateClient();

        var second = await (await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken))).ReadAsync<AuthResponse>();
        second.Tokens!.RefreshToken.Should().NotBe(first.RefreshToken);

        // The first token was already used: someone copied it. The family is revoked, including the new token.
        (await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(first.RefreshToken))).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(second.Tokens.RefreshToken))).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account()
    {
        var person = await factory.CreatePersonAsync();
        var client = factory.CreateClient();

        for (var attempt = 1; attempt <= 4; attempt++)
            (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(person.Email, "wrong-password"))).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(person.Email, "wrong-password"))).StatusCode.Should().Be(HttpStatusCode.Locked);

        // Locked means locked: even the right password is refused for now.
        var correct = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(person.Email, person.Password));
        var problem = await correct.ReadAsync<ProblemDetails>(HttpStatusCode.Locked);
        problem.Detail.Should().Contain("15 minutes");
    }

    [Fact]
    public async Task Organizations_cannot_see_each_others_data()
    {
        var superAdmin = await factory.AsAsync(SuperAdminEmail, SuperAdminPassword);
        var organizations = await (await superAdmin.GetAsync("/api/organizations")).ReadAsync<List<OrganizationDto>>();
        var harbor = organizations.Single(o => o.Slug == "blue-harbor");
        var acme = organizations.Single(o => o.Slug == "acme");

        var admin = await factory.AsAsync(AdminEmail, AdminPassword);
        (await admin.GetAsync($"/api/roles?organizationId={harbor.Id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        // Asking for another tenant's people quietly returns your own: the organization comes from the token.
        var people = await (await admin.GetAsync($"/api/users?organizationId={harbor.Id}")).ReadAsync<List<UserDto>>();
        people.Should().NotBeEmpty().And.OnlyContain(u => u.OrganizationId == acme.Id);

        // The audit log is filtered by the tenant query filter, whatever the caller asks for.
        var audit = await (await admin.GetAsync($"/api/audit?organizationId={harbor.Id}&pageSize=100")).ReadAsync<PagedResult<AuditEventDto>>();
        audit.Items.Should().NotBeEmpty().And.OnlyContain(e => e.OrganizationId == acme.Id);
    }

    [Fact]
    public async Task Nobody_can_grant_a_role_with_permissions_they_do_not_hold()
    {
        // Support can manage people (users.write) but holds no roles.write or invoices permissions.
        var support = await factory.CreatePersonAsync("Support");
        var client = await factory.AsAsync(support.Email, support.Password);
        var me = await (await client.GetAsync("/api/auth/me")).ReadAsync<CurrentUserDto>();
        var roles = await (await client.GetAsync($"/api/roles?organizationId={me.OrganizationId}")).ReadAsync<List<RoleDto>>();
        var target = await factory.CreatePersonAsync();

        var response = await client.PostAsJsonAsync($"/api/users/{target.Id}/roles", new GrantRoleRequest(roles.Single(r => r.Name == "OrgAdmin").Id, null));

        var problem = await response.ReadAsync<ProblemDetails>(HttpStatusCode.Forbidden);
        problem.Detail.Should().Contain("roles.write");
    }

    [Fact]
    public async Task Editors_cannot_remove_their_own_last_source_of_a_permission()
    {
        var admin = await factory.AsAsync(AdminEmail, AdminPassword);
        var me = await (await admin.GetAsync("/api/auth/me")).ReadAsync<CurrentUserDto>();
        var orgAdmin = (await (await admin.GetAsync($"/api/roles?organizationId={me.OrganizationId}")).ReadAsync<List<RoleDto>>()).Single(r => r.Name == "OrgAdmin");

        var response = await admin.PutAsJsonAsync($"/api/roles/{orgAdmin.Id}",
            new UpdateRoleRequest(orgAdmin.Name, orgAdmin.Description, orgAdmin.PermissionCodes.Where(c => c != PermissionCodes.RolesWrite).ToList()));

        (await response.ReadAsync<ProblemDetails>(HttpStatusCode.Conflict)).Detail.Should().Contain("roles.write");
    }

    [Fact]
    public async Task An_approved_request_revokes_the_old_token_and_the_refreshed_one_has_the_permission()
    {
        var viewerAuth = await factory.SignInAsync(ViewerEmail, ViewerPassword);
        var viewer = factory.As(viewerAuth.Tokens!.AccessToken);
        var billing = (await (await viewer.GetAsync($"/api/access-requests/options?permission={PermissionCodes.InvoicesWrite}")).ReadAsync<List<RoleOptionDto>>())
            .Single(r => r.Name == "Billing");

        var request = await (await viewer.PostAsJsonAsync("/api/access-requests",
            new CreateAccessRequestRequest(billing.Id, PermissionCodes.InvoicesWrite, "Covering month-end invoicing this week."))).ReadAsync<AccessRequestDto>();
        request.Status.Should().Be("Pending");

        // Nobody decides their own request; the admin does.
        (await viewer.PostAsJsonAsync($"/api/access-requests/{request.Id}/approve", new ApproveAccessRequestRequest(null, null))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var admin = await factory.AsAsync(AdminEmail, AdminPassword);
        var approved = await (await admin.PostAsJsonAsync($"/api/access-requests/{request.Id}/approve",
            new ApproveAccessRequestRequest(DateTime.UtcNow.AddDays(7), "Until Friday."))).ReadAsync<AccessRequestDto>();
        approved.Status.Should().Be("Approved");

        // The security stamp changed, so the viewer's token stops working at once...
        (await viewer.GetAsync("/api/auth/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        // ...and the refreshed token carries the new permission.
        var refreshed = await (await factory.CreateClient().PostAsJsonAsync("/api/auth/refresh", new RefreshRequest(viewerAuth.Tokens.RefreshToken))).ReadAsync<AuthResponse>();
        refreshed.User!.Permissions.Should().Contain(PermissionCodes.InvoicesWrite);
    }

    [Fact]
    public async Task Validation_failures_are_problem_details_with_field_errors()
    {
        var viewer = await factory.AsAsync(ViewerEmail, ViewerPassword);

        var response = await viewer.PostAsJsonAsync("/api/access-requests", new CreateAccessRequestRequest(Guid.NewGuid(), null, "short"));

        var problem = await response.ReadAsync<ValidationProblemDetails>(HttpStatusCode.BadRequest);
        problem.Errors.Should().ContainKey("Reason");
    }

    [Fact]
    public async Task Expired_temporary_roles_are_removed_and_audited()
    {
        var person = await factory.CreatePersonAsync();
        var admin = await factory.AsAsync(AdminEmail, AdminPassword);
        var me = await (await admin.GetAsync("/api/auth/me")).ReadAsync<CurrentUserDto>();
        var support = (await (await admin.GetAsync($"/api/roles?organizationId={me.OrganizationId}")).ReadAsync<List<RoleDto>>()).Single(r => r.Name == "Support");
        (await admin.PostAsJsonAsync($"/api/users/{person.Id}/roles", new GrantRoleRequest(support.Id, DateTime.UtcNow.AddHours(1)))).StatusCode.Should().Be(HttpStatusCode.OK);

        // Run the Hangfire job as if two hours had passed.
        var clock = new FakeTimeProvider(DateTimeOffset.UtcNow.AddHours(2));
        using (var scope = factory.Services.CreateScope())
            await ActivatorUtilities.CreateInstance<ExpiredRoleAssignmentsJob>(scope.ServiceProvider, clock).RunAsync();

        var user = await (await admin.GetAsync($"/api/users/{person.Id}")).ReadAsync<UserDto>();
        user.Roles.Should().NotContain(r => r.RoleId == support.Id);
        using var check = factory.Services.CreateScope();
        var db = check.ServiceProvider.GetRequiredService<AccessHubDbContext>();
        (await db.AuditEvents.IgnoreQueryFilters().AnyAsync(e => e.Action == "Expired" && e.EntityId == person.Id.ToString())).Should().BeTrue();
    }

    [Fact]
    public async Task Insights_hide_sections_the_caller_may_not_see()
    {
        var viewer = await factory.AsAsync(ViewerEmail, ViewerPassword);

        var insights = await (await viewer.GetAsync("/api/insights")).ReadAsync<InsightsDto>();

        insights.Counts.Users.Should().BeGreaterThan(0);
        insights.Counts.PendingAccessRequests.Should().BeNull("only approvers (users.write) see the queue");
        insights.SignInsPerDay.Should().HaveCount(14);
    }

    [Fact]
    public async Task Realtime_tickets_only_open_the_hub()
    {
        var admin = await factory.AsAsync(AdminEmail, AdminPassword);
        var ticket = await (await admin.PostAsync("/api/realtime/ticket", null)).ReadAsync<RealtimeTicketDto>();

        (await factory.As(ticket.Ticket).GetAsync("/api/auth/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var negotiate = await factory.CreateClient().PostAsync($"{ticket.HubPath}/negotiate?negotiateVersion=1&access_token={Uri.EscapeDataString(ticket.Ticket)}", null);
        negotiate.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task The_audit_export_is_csv_with_formulas_defused()
    {
        var admin = await factory.AsAsync(AdminEmail, AdminPassword);

        var response = await admin.GetAsync("/api/audit/export");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("text/csv");
        // A UTF-8 byte-order mark first, so Excel reads names with accents correctly.
        var bytes = await response.Content.ReadAsByteArrayAsync();
        bytes.Take(3).Should().Equal(0xEF, 0xBB, 0xBF);
        var csv = System.Text.Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        csv.Should().StartWith("TimestampUtc,Action,EntityType");
        csv.Split('\n').Skip(1).Where(line => line.Length > 0).Should().OnlyContain(line => !line.StartsWith('='));
    }

    [Fact]
    public async Task Unknown_routes_and_missing_tokens_are_problem_details()
    {
        var response = await factory.CreateClient().GetAsync("/api/users");

        var problem = await response.ReadAsync<ProblemDetails>(HttpStatusCode.Unauthorized);
        problem.Status.Should().Be(401);
    }
}
