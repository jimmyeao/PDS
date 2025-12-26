using System.Security.Cryptography;
using System.Text;

namespace LicenseGenerator;

class Program
{
    // THIS SECRET MUST MATCH THE ONE IN TheiaCast API appsettings.json
    // KEEP THIS SECRET SECURE - DO NOT DISTRIBUTE TO CUSTOMERS
    private const string HMAC_SECRET = "theiacast-license-hmac-secret-key-minimum-32-characters-long";

    static void Main(string[] args)
    {
        Console.WriteLine("╔═══════════════════════════════════════════════════════════╗");
        Console.WriteLine("║         TheiaCast License Key Generator v1.0             ║");
        Console.WriteLine("║              VENDOR USE ONLY - CONFIDENTIAL              ║");
        Console.WriteLine("╚═══════════════════════════════════════════════════════════╝");
        Console.WriteLine();

        if (args.Length > 0 && args[0] == "--batch")
        {
            BatchMode(args);
            return;
        }

        InteractiveMode();
    }

    static void InteractiveMode()
    {
        while (true)
        {
            Console.WriteLine("\n=== Generate New License ===\n");

            // Select tier
            Console.WriteLine("Select License Tier:");
            Console.WriteLine("  1. Pro-10  (10 devices)");
            Console.WriteLine("  2. Pro-20  (20 devices)");
            Console.WriteLine("  3. Pro-50  (50 devices)");
            Console.WriteLine("  4. Pro-100 (100 devices)");
            Console.WriteLine("  5. Enterprise (custom)");
            Console.WriteLine("  0. Exit");
            Console.Write("\nChoice: ");

            var choice = Console.ReadLine();
            if (choice == "0") break;

            string tier;
            int maxDevices;

            switch (choice)
            {
                case "1":
                    tier = "PRO-10";
                    maxDevices = 10;
                    break;
                case "2":
                    tier = "PRO-20";
                    maxDevices = 20;
                    break;
                case "3":
                    tier = "PRO-50";
                    maxDevices = 50;
                    break;
                case "4":
                    tier = "PRO-100";
                    maxDevices = 100;
                    break;
                case "5":
                    Console.Write("Enter max devices: ");
                    maxDevices = int.Parse(Console.ReadLine() ?? "0");
                    tier = "ENTERPRISE";
                    break;
                default:
                    Console.WriteLine("Invalid choice!");
                    continue;
            }

            Console.Write("Company Name (optional): ");
            var companyName = Console.ReadLine();

            Console.Write("Expiration Date (YYYY-MM-DD, leave blank for perpetual): ");
            var expiryInput = Console.ReadLine();
            DateTime? expiresAt = null;
            if (!string.IsNullOrWhiteSpace(expiryInput))
            {
                expiresAt = DateTime.Parse(expiryInput);
            }

            Console.Write("Notes (optional): ");
            var notes = Console.ReadLine();

            // Generate license
            var licenseKey = GenerateLicenseKey(tier);
            var keyHash = ComputeLicenseKeyHash(licenseKey);

            Console.WriteLine("\n╔═══════════════════════════════════════════════════════════╗");
            Console.WriteLine("║                  LICENSE GENERATED                        ║");
            Console.WriteLine("╚═══════════════════════════════════════════════════════════╝");
            Console.WriteLine($"\n  License Key:    {licenseKey}");
            Console.WriteLine($"  Key Hash:       {keyHash}");
            Console.WriteLine($"  Tier:           {tier}");
            Console.WriteLine($"  Max Devices:    {maxDevices}");
            Console.WriteLine($"  Company:        {companyName ?? "N/A"}");
            Console.WriteLine($"  Expires:        {(expiresAt?.ToString("yyyy-MM-dd") ?? "Never")}");
            Console.WriteLine($"  Notes:          {notes ?? "N/A"}");
            Console.WriteLine($"  Generated:      {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
            Console.WriteLine();

            // Generate SQL INSERT statement
            Console.WriteLine("=== Database SQL (Copy and execute on customer's database) ===\n");
            GenerateSqlInsert(licenseKey, keyHash, tier, maxDevices, companyName, expiresAt, notes);

            Console.WriteLine("\n=== Customer Delivery ===");
            Console.WriteLine($"Send ONLY the License Key to customer: {licenseKey}");
            Console.WriteLine("DO NOT send the Key Hash or SQL - those are for internal use only.");

            Console.WriteLine("\nPress Enter to continue...");
            Console.ReadLine();
        }
    }

    static void BatchMode(string[] args)
    {
        // Example: LicenseGenerator.exe --batch PRO-20 "Acme Corp" 2026-12-31 "Annual subscription"
        if (args.Length < 2)
        {
            Console.WriteLine("Usage: LicenseGenerator.exe --batch <TIER> [CompanyName] [ExpiryDate] [Notes]");
            Console.WriteLine("Example: LicenseGenerator.exe --batch PRO-20 \"Acme Corp\" 2026-12-31 \"Annual subscription\"");
            return;
        }

        var tier = args[1].ToUpper();
        var companyName = args.Length > 2 ? args[2] : null;
        DateTime? expiresAt = null;
        if (args.Length > 3 && !string.IsNullOrWhiteSpace(args[3]))
        {
            expiresAt = DateTime.Parse(args[3]);
        }
        var notes = args.Length > 4 ? args[4] : null;

        int maxDevices = tier switch
        {
            "PRO-10" => 10,
            "PRO-20" => 20,
            "PRO-50" => 50,
            "PRO-100" => 100,
            _ => 999
        };

        var licenseKey = GenerateLicenseKey(tier);
        var keyHash = ComputeLicenseKeyHash(licenseKey);

        // Output as JSON for automation
        Console.WriteLine("{");
        Console.WriteLine($"  \"licenseKey\": \"{licenseKey}\",");
        Console.WriteLine($"  \"keyHash\": \"{keyHash}\",");
        Console.WriteLine($"  \"tier\": \"{tier.ToLower()}\",");
        Console.WriteLine($"  \"maxDevices\": {maxDevices},");
        Console.WriteLine($"  \"companyName\": {(companyName != null ? $"\"{companyName}\"" : "null")},");
        Console.WriteLine($"  \"expiresAt\": {(expiresAt.HasValue ? $"\"{expiresAt.Value:yyyy-MM-dd}\"" : "null")},");
        Console.WriteLine($"  \"notes\": {(notes != null ? $"\"{notes}\"" : "null")},");
        Console.WriteLine($"  \"generatedAt\": \"{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}\"");
        Console.WriteLine("}");
    }

    static string GenerateLicenseKey(string tier)
    {
        var random = Convert.ToBase64String(RandomNumberGenerator.GetBytes(12))
            .TrimEnd('=')
            .Replace("+", "-")
            .Replace("/", "_");

        var keyPreChecksum = $"LK-1-{tier}-{random}";
        var checksum = ComputeChecksum(keyPreChecksum).Substring(0, 4).ToUpper();

        return $"{keyPreChecksum}-{checksum}";
    }

    static string ComputeChecksum(string input)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(HMAC_SECRET));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash);
    }

    static string ComputeLicenseKeyHash(string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(HMAC_SECRET));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hash).ToLower();
    }

    static void GenerateSqlInsert(string licenseKey, string keyHash, string tier, int maxDevices,
        string? companyName, DateTime? expiresAt, string? notes)
    {
        var sql = new StringBuilder();
        sql.AppendLine("INSERT INTO \"Licenses\" (");
        sql.AppendLine("    \"Key\", \"KeyHash\", \"Tier\", \"MaxDevices\", \"CurrentDeviceCount\",");
        sql.AppendLine("    \"CompanyName\", \"ContactEmail\", \"IsActive\", \"ExpiresAt\", \"CreatedAt\", \"Notes\"");
        sql.AppendLine(") VALUES (");
        sql.AppendLine($"    '{licenseKey}',");
        sql.AppendLine($"    '{keyHash}',");
        sql.AppendLine($"    '{tier.ToLower()}',");
        sql.AppendLine($"    {maxDevices},");
        sql.AppendLine($"    0,");
        sql.AppendLine($"    {(companyName != null ? $"'{companyName.Replace("'", "''")}'" : "NULL")},");
        sql.AppendLine($"    NULL,");
        sql.AppendLine($"    true,");
        sql.AppendLine($"    {(expiresAt.HasValue ? $"'{expiresAt.Value:yyyy-MM-dd}'::timestamp" : "NULL")},");
        sql.AppendLine($"    CURRENT_TIMESTAMP,");
        sql.AppendLine($"    {(notes != null ? $"'{notes.Replace("'", "''")}'" : "NULL")}");
        sql.AppendLine(");");

        Console.WriteLine(sql.ToString());
    }
}
