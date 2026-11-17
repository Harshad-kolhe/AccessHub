using System.Security.Cryptography;
using System.Text.Json;
using AccessHub.Application.Interfaces;
using AccessHub.Domain.Constants;
using AccessHub.Domain.Entities;
using AccessHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AccessHub.Infrastructure.Seed;

/// <summary>
/// Applies migrations, creates the permission catalog and, on an empty database, a demo platform: two
/// organizations with people, roles, temporary grants, access requests, invoices and two weeks of audit and
/// sign-in history, so every page and chart has something to show on first run.
/// </summary>
/// <remarks>
/// Demo sign-ins (also on the login page): admin@acme.local / Admin123!, viewer@acme.local / Viewer123!,
/// superadmin@accesshub.local / SuperAdmin123!. Everyone else gets a random password nobody knows.
/// </remarks>
public static class DataSeeder
{
    public const string SuperAdminEmail = "superadmin@accesshub.local";
    public const string AcmeAdminEmail = "admin@acme.local";
    public const string AcmeViewerEmail = "viewer@acme.local";

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AccessHubDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        await db.Database.MigrateAsync();
        await SeedPermissionsAsync(db);

        if (configuration.GetValue("Seed:DemoData", true) && !await userManager.Users.AnyAsync())
            await new DemoPlatform(db, userManager).CreateAsync();

        // Seeding has no tenant, so it reads across organizations explicitly.
        if (configuration.GetValue("Seed:DemoHistory", true) && !await db.SignInAttempts.IgnoreQueryFilters().AnyAsync())
            await SeedSignInHistoryAsync(db);
    }

    /// <summary>The demo platform and its history on an emptied database (used by the nightly demo reset).</summary>
    public static async Task SeedDemoDataAsync(AccessHubDbContext db, UserManager<ApplicationUser> userManager, IConfiguration configuration)
    {
        await new DemoPlatform(db, userManager).CreateAsync();
        if (configuration.GetValue("Seed:DemoHistory", true))
            await SeedSignInHistoryAsync(db);
    }

    private static async Task SeedPermissionsAsync(AccessHubDbContext db)
    {
        if (await db.Permissions.AnyAsync())
            return;

        db.Permissions.AddRange(
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.OrganizationsManage, DisplayName = "Manage Organizations", Description = "Create and manage organizations" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.UsersRead, DisplayName = "Read Users", Description = "View users" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.UsersWrite, DisplayName = "Write Users", Description = "Invite, update and deactivate users; grant and remove roles" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.RolesRead, DisplayName = "Read Roles", Description = "View roles" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.RolesWrite, DisplayName = "Write Roles", Description = "Create, change and delete roles" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.AuditRead, DisplayName = "Read Audit Log", Description = "View audit events" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.InvoicesRead, DisplayName = "Read Invoices", Description = "View invoices" },
            new Permission { Id = Guid.NewGuid(), Code = PermissionCodes.InvoicesWrite, DisplayName = "Write Invoices", Description = "Create invoices" });
        await db.SaveChangesAsync();
    }

    /// <summary>The demo story, backdated two weeks so the log and the charts have a history from day one.</summary>
    private sealed class DemoPlatform(AccessHubDbContext db, UserManager<ApplicationUser> userManager)
    {
        private readonly DateTime _now = DateTime.UtcNow;
        private Dictionary<string, Permission> _permissions = [];

        // 09:00 UTC thirteen days ago: the first day of a 14-day chart that ends today.
        private DateTime Day(int day, double hours = 0) => _now.Date.AddDays(-13 + day).AddHours(9 + hours);
        private DateTime Ago(double hours) => _now.AddHours(-hours);

        public async Task CreateAsync()
        {
            _permissions = await db.Permissions.ToDictionaryAsync(p => p.Code);
            var superAdmin = await PersonAsync(SuperAdminEmail, "Super Admin", null, Day(0, -1), "SuperAdmin123!", isSuperAdmin: true);

            // ----- Acme Corp: the main demo tenant -----
            var acme = Organization("Acme Corp", "acme", accent: null, Day(0), superAdmin);
            var orgAdmin = AddRole(acme, "OrgAdmin", "Full organization administrator", Day(0, 0.1), superAdmin, PermissionCodes.OrganizationScoped);
            var admin = await PersonAsync(AcmeAdminEmail, "Acme Admin", acme, Day(1), "Admin123!", createdBy: superAdmin);
            Grant(admin, orgAdmin, Day(1, 0.05), superAdmin);

            var viewerRole = AddRole(acme, "Viewer", "Read-only access", Day(1, 1), admin, PermissionCodes.UsersRead, PermissionCodes.InvoicesRead);
            var viewer = await PersonAsync(AcmeViewerEmail, "Acme Viewer", acme, Day(1, 2), "Viewer123!", createdBy: admin);
            Grant(viewer, viewerRole, Day(1, 2.05), admin);

            var billing = AddRole(acme, "Billing", "Issues and reads invoices", Day(2), admin, PermissionCodes.InvoicesRead, PermissionCodes.InvoicesWrite);
            var support = AddRole(acme, "Support", "Helps people with their accounts", Day(2, 0.2), admin, PermissionCodes.UsersRead, PermissionCodes.UsersWrite, PermissionCodes.RolesRead);
            var priya = await PersonAsync("priya.raman@acme.local", "Priya Raman", acme, Day(2, 1), createdBy: admin);
            Grant(priya, billing, Day(2, 1.05), admin);
            var sam = await PersonAsync("sam.torres@acme.local", "Sam Torres", acme, Day(2, 2), createdBy: admin);
            Grant(sam, support, Day(2, 2.05), admin);

            var marcus = await PersonAsync("marcus.webb@acme.local", "Marcus Webb", acme, Day(3, 0.5), createdBy: admin);
            Grant(marcus, support, Day(3, 0.55), admin);
            await EnableTwoFactorAsync(priya, Day(3, 4));

            var auditor = AddRole(acme, "Security Auditor", "Reviews the audit log and who has access", Day(4), admin, PermissionCodes.AuditRead, PermissionCodes.UsersRead, PermissionCodes.RolesRead);
            var elena = await PersonAsync("elena.novak@acme.local", "Elena Novak", acme, Day(4, 1), createdBy: admin);
            Grant(elena, viewerRole, Day(4, 1.05), admin);
            await EnableTwoFactorAsync(elena, Day(4, 3));

            var daniel = await PersonAsync("daniel.okafor@acme.local", "Daniel Okafor", acme, Day(5, 1), createdBy: admin);
            Grant(daniel, viewerRole, Day(5, 1.05), admin);
            // A two-day grant that the expiry job later removed.
            Grant(daniel, auditor, Day(5, 1.5), admin, expiresAt: Day(7, 1.5), keep: false);
            Audit(null, acme, "Expired", "RoleAssignment", daniel.Id, Assignment(daniel, auditor, Day(7, 1.5)), Day(7, 1.5));

            // Sam asked for admin rights and was turned down.
            Request(sam, orgAdmin, null, "I need to add the two new support hires myself.", Day(6, 2),
                AccessRequestStatus.Rejected, admin, Day(6, 5), "Marcus can invite them. Admin access stays with IT.");

            // After the night of password guesses against the viewer account (see the sign-in history).
            Audit(viewer, acme, "PasswordReset", "User", viewer.Id, new { viewer.Email, viewer.FullName }, Day(8, -0.3));

            UpdateRole(viewerRole, admin, Day(8, 2), [PermissionCodes.UsersRead, PermissionCodes.InvoicesRead],
                [PermissionCodes.UsersRead, PermissionCodes.RolesRead, PermissionCodes.AuditRead, PermissionCodes.InvoicesRead]);

            // Sam left the company: deactivated and their role removed.
            sam.IsActive = false;
            Audit(admin, acme, "Updated", "User", sam.Id, new
            {
                Before = new { sam.FullName, IsActive = true },
                After = new { sam.FullName, IsActive = false },
            }, Day(9, 3));
            Revoke(sam, support, admin, Day(9, 3.1));

            // Daniel covers month-end billing for two weeks, approved through an access request.
            var approvedUntil = _now.Date.AddDays(10).AddHours(17);
            Request(daniel, billing, PermissionCodes.InvoicesWrite, "Covering month-end invoicing while Priya is on leave.", Ago(4 * 24 + 3),
                AccessRequestStatus.Approved, admin, Ago(4 * 24 + 1), "Approved until Priya is back.", approvedUntil);
            Grant(daniel, billing, Ago(4 * 24 + 1), admin, expiresAt: approvedUntil, audit: false);

            // Elena is reviewing access this week: a temporary auditor grant that ends soon.
            Grant(elena, auditor, Ago(2 * 24), admin, expiresAt: _now.Date.AddDays(3).AddHours(17));

            var hannah = await PersonAsync("hannah.lee@acme.local", "Hannah Lee", acme, Ago(26), createdBy: admin, invited: true);
            Grant(hannah, viewerRole, Ago(26), admin, audit: false);

            // Waiting for an approver right now.
            Request(marcus, auditor, PermissionCodes.AuditRead,
                "A customer reported a sign-in they don't recognise. I need the audit log for this week to check.", Ago(3));

            AddInvoices(acme, admin, [
                ("INV-1001", "Contoso Ltd", 1500.00m, Day(1, 5)),
                ("INV-1002", "Fabrikam Inc", 3200.50m, Day(3, 2)),
                ("INV-1003", "Northwind Traders", 845.00m, Day(5, 3)),
                ("INV-1004", "Tailspin Toys", 12400.00m, Day(6, 1)),
                ("INV-1005", "Wide World Importers", 2150.75m, Day(8, 4)),
                ("INV-1006", "Adventure Works", 640.00m, Day(10, 2)),
            ]);
            AddInvoices(acme, daniel, [
                ("INV-1007", "Litware Inc", 5980.00m, Ago(2 * 24 + 5)),
                ("INV-1008", "Proseware", 1120.00m, Ago(6)),
            ]);

            // ----- Blue Harbor Logistics: a second tenant, invisible to Acme -----
            var harbor = Organization("Blue Harbor Logistics", "blue-harbor", accent: "teal", Day(2, -0.5), superAdmin);
            var harborAdminRole = AddRole(harbor, "OrgAdmin", "Full organization administrator", Day(2, -0.4), superAdmin, PermissionCodes.OrganizationScoped);
            var ines = await PersonAsync("ines.duarte@blueharbor.local", "Ines Duarte", harbor, Day(2, -0.3), createdBy: superAdmin);
            Grant(ines, harborAdminRole, Day(2, -0.25), superAdmin);
            var harborViewer = AddRole(harbor, "Viewer", "Read-only access", Day(2, 3), ines, PermissionCodes.UsersRead, PermissionCodes.RolesRead, PermissionCodes.InvoicesRead);
            var harborBilling = AddRole(harbor, "Billing", "Issues and reads invoices", Day(2, 3.2), ines, PermissionCodes.InvoicesRead, PermissionCodes.InvoicesWrite);
            var aiko = await PersonAsync("aiko.tanaka@blueharbor.local", "Aiko Tanaka", harbor, Day(3, 2), createdBy: ines);
            Grant(aiko, harborViewer, Day(3, 2.05), ines);
            var lukas = await PersonAsync("lukas.brandt@blueharbor.local", "Lukas Brandt", harbor, Day(6, 4), createdBy: ines);
            Grant(lukas, harborBilling, Day(6, 4.05), ines);
            AddInvoices(harbor, lukas, [
                ("BH-0201", "Kestrel Freight", 4300.00m, Day(7, 2)),
                ("BH-0202", "Marlow & Finch", 990.00m, Day(9, 5)),
                ("BH-0203", "Pinecrest Foods", 7250.00m, Ago(30)),
            ]);

            await db.SaveChangesAsync();
        }

        private Organization Organization(string name, string slug, string? accent, DateTime at, ApplicationUser createdBy)
        {
            var org = new Organization { Id = Guid.NewGuid(), Name = name, Slug = slug, Accent = accent, IsActive = true, CreatedAtUtc = at };
            db.Organizations.Add(org);
            Audit(createdBy, org, "Created", "Organization", org.Id, new { org.Name, org.Slug, org.Accent }, at);
            return org;
        }

        private async Task<ApplicationUser> PersonAsync(
            string email, string fullName, Organization? org, DateTime at, string? password = null,
            bool isSuperAdmin = false, ApplicationUser? createdBy = null, bool invited = false)
        {
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                EmailConfirmed = !invited,
                FullName = fullName,
                OrganizationId = org?.Id,
                IsSuperAdmin = isSuperAdmin,
                IsActive = true,
                CreatedAtUtc = at,
            };

            // Invited people have no password until they accept; everyone else not listed in the README gets
            // a random one, so only the three demo accounts can sign in.
            var result = invited
                ? await userManager.CreateAsync(user)
                : await userManager.CreateAsync(user, password ?? RandomPassword());
            if (!result.Succeeded)
                throw new InvalidOperationException($"Could not seed {email}: {string.Join(" ", result.Errors.Select(e => e.Description))}");

            if (createdBy is not null && org is not null)
                Audit(createdBy, org, invited ? "Invited" : "Created", "User", user.Id, new { user.Email, user.FullName }, at);
            return user;
        }

        private async Task EnableTwoFactorAsync(ApplicationUser user, DateTime at)
        {
            await userManager.ResetAuthenticatorKeyAsync(user);
            await userManager.SetTwoFactorEnabledAsync(user, true);
            Audit(user, OrganizationOf(user), "EnabledTwoFactor", "User", user.Id, new { user.Email, user.FullName }, at);
        }

        private Role AddRole(Organization org, string name, string description, DateTime at, ApplicationUser createdBy, params string[] codes)
        {
            var role = new Role { Id = Guid.NewGuid(), OrganizationId = org.Id, Organization = org, Name = name, Description = description, CreatedAtUtc = at };
            db.OrgRoles.Add(role);
            foreach (var code in codes)
                db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = _permissions[code].Id });
            Audit(createdBy, org, "Created", "Role", role.Id, new { role.Name, PermissionCodes = codes }, at);
            return role;
        }

        private void UpdateRole(Role role, ApplicationUser by, DateTime at, string[] before, string[] after)
        {
            foreach (var code in after.Except(before))
                db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = _permissions[code].Id });
            Audit(by, role.Organization, "Updated", "Role", role.Id, new
            {
                Before = new { role.Name, role.Description, PermissionCodes = before.Order().ToArray() },
                After = new { role.Name, role.Description, PermissionCodes = after.Order().ToArray() },
            }, at);
        }

        private void Grant(ApplicationUser user, Role role, DateTime at, ApplicationUser by, DateTime? expiresAt = null, bool keep = true, bool audit = true)
        {
            if (keep)
                db.OrgUserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, AssignedAtUtc = at, GrantedByUserId = by.Id, ExpiresAtUtc = expiresAt });
            if (audit)
                Audit(by, role.Organization, "Granted", "RoleAssignment", user.Id, Assignment(user, role, expiresAt), at);
        }

        private void Revoke(ApplicationUser user, Role role, ApplicationUser by, DateTime at)
        {
            // Creating users saves as it goes, so the assignment may already be in the database.
            db.OrgUserRoles.Remove(db.ChangeTracker.Entries<UserRole>().Single(e => e.Entity.UserId == user.Id && e.Entity.RoleId == role.Id).Entity);
            Audit(by, role.Organization, "Revoked", "RoleAssignment", user.Id, new { Name = $"{user.FullName}: {role.Name}", User = user.FullName, Role = role.Name }, at);
        }

        private static object Assignment(ApplicationUser user, Role role, DateTime? expiresAt) =>
            new { Name = $"{user.FullName}: {role.Name}", User = user.FullName, Role = role.Name, ExpiresAtUtc = expiresAt };

        private void Request(
            ApplicationUser requester, Role role, string? permission, string reason, DateTime at,
            AccessRequestStatus status = AccessRequestStatus.Pending, ApplicationUser? decidedBy = null,
            DateTime? decidedAt = null, string? note = null, DateTime? grantExpiresAt = null)
        {
            var request = new AccessRequest
            {
                Id = Guid.NewGuid(),
                OrganizationId = role.OrganizationId,
                RequesterUserId = requester.Id,
                RoleId = role.Id,
                Permission = permission,
                Reason = reason,
                Status = status,
                CreatedAtUtc = at,
                DecidedByUserId = decidedBy?.Id,
                DecidedAtUtc = decidedAt,
                DecisionNote = note,
                GrantExpiresAtUtc = grantExpiresAt,
            };
            db.AccessRequests.Add(request);
            Audit(requester, role.Organization, "Requested", "AccessRequest", request.Id, new { Name = role.Name, Role = role.Name, Permission = permission, Reason = reason }, at);
            if (decidedBy is not null && decidedAt is not null)
                Audit(decidedBy, role.Organization, status.ToString(), "AccessRequest", request.Id, new
                {
                    Name = $"{requester.FullName}: {role.Name}",
                    Requester = requester.FullName,
                    Role = role.Name,
                    ExpiresAtUtc = grantExpiresAt,
                    Note = note,
                }, decidedAt.Value);
        }

        private void AddInvoices(Organization org, ApplicationUser by, (string Number, string Customer, decimal Amount, DateTime At)[] invoices)
        {
            foreach (var (number, customer, amount, at) in invoices)
            {
                var invoice = new Invoice { Id = Guid.NewGuid(), OrganizationId = org.Id, Number = number, CustomerName = customer, Amount = amount, CreatedAtUtc = at };
                db.Invoices.Add(invoice);
                Audit(by, org, "Created", "Invoice", invoice.Id, new { Name = number, Number = number, CustomerName = customer, Amount = amount }, at);
            }
        }

        private Organization? OrganizationOf(ApplicationUser user) =>
            db.ChangeTracker.Entries<Organization>().Select(e => e.Entity).FirstOrDefault(o => o.Id == user.OrganizationId);

        private void Audit(ApplicationUser? actor, Organization? org, string action, string entityType, Guid entityId, object payload, DateTime at) =>
            db.AuditEvents.Add(new AuditEvent
            {
                Id = Guid.NewGuid(),
                ActorUserId = actor?.Id ?? AuditActors.System,
                OrganizationId = org?.Id,
                Action = action,
                EntityType = entityType,
                EntityId = entityId.ToString(),
                PayloadJson = JsonSerializer.Serialize(payload),
                CreatedAtUtc = at,
            });

        private static string RandomPassword() => $"Aa1-{Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))}";
    }

    /// <summary>Two weeks of plausible sign-ins (and failures, including one burst) for the security charts.</summary>
    private static async Task SeedSignInHistoryAsync(AccessHubDbContext db)
    {
        // Typical sign-ins per working day (minimum, maximum) for the people the demo knows about.
        var activity = new Dictionary<string, (int Min, int Max)>
        {
            [AcmeAdminEmail] = (1, 3),
            [AcmeViewerEmail] = (0, 2),
            ["priya.raman@acme.local"] = (1, 2),
            ["marcus.webb@acme.local"] = (0, 2),
            ["elena.novak@acme.local"] = (0, 1),
            ["daniel.okafor@acme.local"] = (0, 2),
            ["ines.duarte@blueharbor.local"] = (0, 2),
            ["aiko.tanaka@blueharbor.local"] = (0, 1),
            ["lukas.brandt@blueharbor.local"] = (0, 1),
        };

        var emails = activity.Keys.Append(SuperAdminEmail).ToList();
        var people = await db.Users.Where(u => emails.Contains(u.Email!) && u.IsActive).ToListAsync();
        var admin = people.FirstOrDefault(u => u.Email == AcmeAdminEmail);
        var viewer = people.FirstOrDefault(u => u.Email == AcmeViewerEmail);
        var superAdmin = people.FirstOrDefault(u => u.Email == SuperAdminEmail);
        if (admin is null || viewer is null)
            return;

        string[] agents =
        [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1",
        ];
        var random = new Random(1337);
        var now = DateTime.UtcNow;

        void Attempt(ApplicationUser? user, string email, bool succeeded, string? reason, DateTime at, string ip)
        {
            if (at > now || (user is not null && at < user.CreatedAtUtc))
                return;
            db.SignInAttempts.Add(new SignInAttempt
            {
                Id = Guid.NewGuid(),
                UserId = user?.Id,
                OrganizationId = user?.OrganizationId,
                Email = email,
                Succeeded = succeeded,
                FailureReason = reason,
                IpAddress = ip,
                UserAgent = agents[random.Next(agents.Length)],
                OccurredAtUtc = at,
            });
            if (succeeded && user is not null && (user.LastSignInAtUtc is null || user.LastSignInAtUtc < at))
                user.LastSignInAtUtc = at;
        }

        for (var daysAgo = 13; daysAgo >= 0; daysAgo--)
        {
            var day = now.Date.AddDays(-daysAgo);
            var weekend = day.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            DateTime At() => day.AddHours(7 + random.Next(11)).AddMinutes(random.Next(60));

            foreach (var person in people.Where(p => activity.ContainsKey(p.Email!)))
            {
                var (min, max) = activity[person.Email!];
                var count = weekend ? random.Next(0, 2) * Math.Min(1, max) : random.Next(min, max + 1);
                var ip = $"203.0.113.{10 + people.IndexOf(person) * 7}";
                for (var i = 0; i < count; i++)
                    Attempt(person, person.Email!, true, null, At(), ip);
                if (random.Next(9) == 0)
                    Attempt(person, person.Email!, false, SignInFailureReasons.InvalidCredentials, At(), ip);
            }

            if (superAdmin is not null && daysAgo % 3 == 0)
                Attempt(superAdmin, superAdmin.Email!, true, null, At(), "198.51.100.7");

            // One night with a burst of guesses against the viewer account from a single address, which ends in a
            // lockout, plus a few tries at addresses that don't exist (only super admins see those).
            if (daysAgo == 5)
            {
                var burst = day.AddHours(3).AddMinutes(12);
                for (var i = 0; i < 7; i++)
                    Attempt(viewer, viewer.Email!, false, i < 5 ? SignInFailureReasons.InvalidCredentials : SignInFailureReasons.LockedOut, burst.AddSeconds(20 * i), "192.0.2.66");
                foreach (var guess in new[] { "root@acme.local", "it@acme.local", "test@acme.local" })
                    Attempt(null, guess, false, SignInFailureReasons.InvalidCredentials, burst.AddMinutes(4).AddSeconds(random.Next(50)), "192.0.2.66");
            }
        }

        await db.SaveChangesAsync();
    }
}
