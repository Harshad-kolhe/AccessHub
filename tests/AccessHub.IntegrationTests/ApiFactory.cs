using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace AccessHub.IntegrationTests;

/// <summary>
/// The real API (every middleware, filter and query filter) against a real SQL Server, seeded with the demo data.
/// The database is a Testcontainers SQL Server, or, when ACCESSHUB_TEST_SQL names a server (machines without
/// Docker), a throwaway database on it that is dropped afterwards.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private MsSqlContainer? _container;
    private string _connectionString = string.Empty;

    public async Task InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable("ACCESSHUB_TEST_SQL");
        if (string.IsNullOrWhiteSpace(server))
        {
            _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
            await _container.StartAsync();
            _connectionString = new SqlConnectionStringBuilder(_container.GetConnectionString()) { InitialCatalog = "AccessHub" }.ConnectionString;
        }
        else
        {
            _connectionString = new SqlConnectionStringBuilder(server) { InitialCatalog = $"AccessHub_Tests_{Guid.NewGuid():N}" }.ConnectionString;
        }

        // Environment variables win over appsettings.json, and the API's .env loader never overwrites them.
        Set("ConnectionStrings__DefaultConnection", _connectionString);
        Set("Jwt__Key", "integration-tests-only-key-0123456789abcdef");
        Set("Hangfire__Enabled", "false");
        Set("RateLimiting__AuthPermitPerMinute", "10000");
        Set("RateLimiting__RefreshPermitPerMinute", "10000");
        Set("Auth__RefreshReuseGraceSeconds", "0");
        Set("Seed__DemoHistory", "false");
        Set("Demo__Enabled", "false");
        Set("Email__Smtp__Host", "");

        // Starting the host runs the migrations and the seeder.
        _ = Server;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Testing");

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        if (_container is not null)
        {
            await _container.DisposeAsync();
            return;
        }

        SqlConnection.ClearAllPools();
        var database = new SqlConnectionStringBuilder(_connectionString).InitialCatalog;
        await using var connection = new SqlConnection(new SqlConnectionStringBuilder(_connectionString) { InitialCatalog = "master" }.ConnectionString);
        await connection.OpenAsync();
        await using var drop = connection.CreateCommand();
        drop.CommandText = $"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}];";
        await drop.ExecuteNonQueryAsync();
    }

    private static void Set(string name, string value) => Environment.SetEnvironmentVariable(name, value);
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
