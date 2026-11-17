using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AccessHub.Application.DTOs;
using FluentAssertions;

namespace AccessHub.IntegrationTests;

/// <summary>Small helpers for calling the API the way the Next.js server does.</summary>
public static class ApiClient
{
    public const string AdminEmail = "admin@acme.local";
    public const string AdminPassword = "Admin123!";
    public const string ViewerEmail = "viewer@acme.local";
    public const string ViewerPassword = "Viewer123!";
    public const string SuperAdminEmail = "superadmin@accesshub.local";
    public const string SuperAdminPassword = "SuperAdmin123!";

    public static async Task<AuthResponse> SignInAsync(this ApiFactory factory, string email, string password)
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        response.StatusCode.Should().Be(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        auth!.Tokens.Should().NotBeNull();
        return auth;
    }

    /// <summary>An HttpClient that sends the access token, like the Next.js server does.</summary>
    public static HttpClient As(this ApiFactory factory, string accessToken)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    public static async Task<HttpClient> AsAsync(this ApiFactory factory, string email, string password) =>
        factory.As((await factory.SignInAsync(email, password)).Tokens!.AccessToken);

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        response.StatusCode.Should().Be(expected, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    /// <summary>Creates a person in Acme with a known password and the given roles, as the Acme admin.</summary>
    public static async Task<(Guid Id, string Email, string Password)> CreatePersonAsync(this ApiFactory factory, params string[] roleNames)
    {
        var admin = await factory.AsAsync(AdminEmail, AdminPassword);
        var me = await (await admin.GetAsync("/api/auth/me")).ReadAsync<CurrentUserDto>();
        var roles = await (await admin.GetAsync($"/api/roles?organizationId={me.OrganizationId}")).ReadAsync<List<RoleDto>>();
        var email = $"test-{Guid.NewGuid():N}@acme.local";
        const string password = "Test-Passw0rd";
        var created = await (await admin.PostAsJsonAsync("/api/users", new CreateUserRequest(
            email, password, "Test Person", me.OrganizationId!.Value, roles.Where(r => roleNames.Contains(r.Name)).Select(r => r.Id).ToList())))
            .ReadAsync<UserDto>(HttpStatusCode.Created);
        return (created.Id, email, password);
    }
}
