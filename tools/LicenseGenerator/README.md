# TheiaCast License Generator

**🔒 VENDOR USE ONLY - CONFIDENTIAL**

This tool is for **TheiaCast vendors only** to generate license keys. **DO NOT** distribute this tool to customers.

## Security Model

- **Customers** can only VALIDATE licenses (built into TheiaCast application)
- **Vendors** can GENERATE licenses using this standalone tool
- The HMAC secret must be kept confidential and shared between this tool and the TheiaCast API

## Building the Tool

```bash
cd tools/LicenseGenerator
dotnet build
```

## Running the Tool

### Interactive Mode (Recommended)

```bash
dotnet run
```

This will start an interactive menu where you can:
1. Select license tier (Pro-10, Pro-20, Pro-50, Pro-100, Enterprise)
2. Enter company name (optional)
3. Set expiration date (optional)
4. Add notes (optional)

The tool will output:
- **License Key** (send to customer)
- **Key Hash** (for internal records)
- **SQL INSERT statement** (to add to customer's database)

### Batch Mode (For Automation)

```bash
dotnet run -- --batch PRO-20 "Acme Corp" 2026-12-31 "Annual subscription"
```

Output is JSON format for integration with payment/CRM systems.

## How It Works

### License Key Format

```
LK-1-PRO-20-xY9mKp3rT4u-BC8F
│  │ │      │            │
│  │ │      │            └─ Checksum (HMAC-SHA256)
│  │ │      └────────────── Random component (base64)
│  │ └───────────────────── Tier (PRO-10, PRO-20, etc.)
│  └─────────────────────── Version (1)
└────────────────────────── Prefix (LK)
```

### Security

- License keys are hashed using HMAC-SHA256
- Only the hash is stored in the database, not the key itself
- The HMAC secret is shared between this tool and the TheiaCast API
- **DO NOT** commit the HMAC secret to version control

### HMAC Secret Configuration

**In this tool (Program.cs):**
```csharp
private const string HMAC_SECRET = "theiacast-license-hmac-secret-key-minimum-32-characters-long";
```

**In TheiaCast API (appsettings.json):**
```json
{
  "License": {
    "Secret": "theiacast-license-hmac-secret-key-minimum-32-characters-long"
  }
}
```

⚠️ **These MUST match exactly!**

## License Tiers

| Tier | Max Devices | Suggested Price |
|------|-------------|-----------------|
| PRO-10 | 10 | $499/year |
| PRO-20 | 20 | $899/year |
| PRO-50 | 50 | $1,999/year |
| PRO-100 | 100 | $3,499/year |
| ENTERPRISE | Custom | Custom pricing |

## Usage Workflow

### 1. Customer Purchases License

Customer buys a Pro-20 license through your sales process.

### 2. Generate License

Run this tool:
```bash
dotnet run
# Select option 2 (Pro-20)
# Enter company name: "Acme Corporation"
# Leave expiration blank for perpetual
```

### 3. Tool Outputs

```
╔═══════════════════════════════════════════════════════════╗
║                  LICENSE GENERATED                        ║
╚═══════════════════════════════════════════════════════════╝

  License Key:    LK-1-PRO-20-xY9mKp3rT4u-BC8F
  Key Hash:       a7f3b9c1d2e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5
  Tier:           PRO-20
  Max Devices:    20
  Company:        Acme Corporation
  Expires:        Never
  Notes:          N/A
  Generated:      2025-12-26 12:00:00 UTC

=== Database SQL (Copy and execute on customer's database) ===

INSERT INTO "Licenses" (
    "Key", "KeyHash", "Tier", "MaxDevices", "CurrentDeviceCount",
    "CompanyName", "ContactEmail", "IsActive", "ExpiresAt", "CreatedAt", "Notes"
) VALUES (
    'LK-1-PRO-20-xY9mKp3rT4u-BC8F',
    'a7f3b9c1d2e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5',
    'pro-20',
    20,
    0,
    'Acme Corporation',
    NULL,
    true,
    NULL,
    CURRENT_TIMESTAMP,
    NULL
);

=== Customer Delivery ===
Send ONLY the License Key to customer: LK-1-PRO-20-xY9mKp3rT4u-BC8F
DO NOT send the Key Hash or SQL - those are for internal use only.
```

### 4. Add License to Customer's Database

**Option A: Direct Database Access**
If you have direct access to the customer's PostgreSQL database:
```bash
psql -h customer-db-host -U postgres -d theiacast
# Paste the SQL INSERT statement
```

**Option B: Via Customer's TheiaCast Admin Panel**
If the customer has a self-hosted instance:
1. They provide you database access credentials
2. You run the SQL INSERT remotely
3. License becomes active immediately

**Option C: Cloud/SaaS Model**
If running a centralized SaaS:
1. SQL INSERT runs on your central database
2. All customers share the same database
3. License assignment is automatic

### 5. Send License Key to Customer

Email the customer:
```
Subject: Your TheiaCast Pro-20 License

Dear Acme Corporation,

Thank you for purchasing TheiaCast Pro-20!

Your License Key: LK-1-PRO-20-xY9mKp3rT4u-BC8F
Max Devices: 20
Expires: Never

Your license has been activated on your TheiaCast instance.
You can now register up to 20 devices.

Best regards,
TheiaCast Team
```

### 6. Customer Uses TheiaCast

The customer's TheiaCast installation will:
- Automatically validate the license on device registration
- Track device count (devices 1-20 allowed)
- Enforce limits with 7-day grace period
- Show license status in the admin panel

## Important Notes

### DO NOT

- ❌ Distribute this tool to customers
- ❌ Commit the HMAC secret to public repositories
- ❌ Share the SQL INSERT statements with customers
- ❌ Allow customers to generate their own licenses

### DO

- ✅ Keep this tool secure (internal use only)
- ✅ Use strong, random HMAC secrets
- ✅ Keep the secret in sync between generator and API
- ✅ Maintain a record of generated licenses
- ✅ Send only the license KEY to customers, not the hash

## Troubleshooting

### "License validation failed"

**Cause:** HMAC secret mismatch between generator and API

**Solution:** Verify that `Program.cs` and `appsettings.json` have identical secrets

### "License not found"

**Cause:** License not added to customer's database

**Solution:** Run the SQL INSERT statement on their database

### "Invalid license key"

**Cause:** Customer typed the key incorrectly

**Solution:** Ensure no spaces, correct case (keys are case-sensitive)

## Production Recommendations

1. **Secure Storage**: Store generated licenses in a secure database/CRM
2. **Automation**: Integrate with Stripe/PayPal webhooks for automatic generation
3. **Customer Portal**: Build a vendor portal for license management
4. **Expiration Tracking**: Set up alerts for licenses nearing expiration
5. **Audit Trail**: Log all license generation events

## Example Integration with Stripe

```csharp
// In your Stripe webhook handler
[HttpPost("/webhooks/stripe")]
public async Task<IActionResult> StripeWebhook()
{
    // Verify webhook signature...

    if (stripeEvent.Type == "checkout.session.completed")
    {
        var session = stripeEvent.Data.Object as Session;
        var tier = session.Metadata["tier"]; // "PRO-20"
        var customerEmail = session.CustomerEmail;

        // Generate license
        var result = await RunLicenseGenerator(tier, customerEmail);

        // Email customer the license key
        await SendLicenseEmail(customerEmail, result.LicenseKey);

        // Store in your CRM/database
        await SaveLicenseRecord(result);
    }

    return Ok();
}
```

## Security Best Practices

1. **Rotate Secrets Periodically**: Change HMAC secret every 12 months
2. **Access Control**: Only trusted staff can run this tool
3. **Audit Logs**: Log all license generations with timestamp and operator
4. **Backup**: Maintain secure backups of all generated licenses
5. **Revocation**: Use the TheiaCast admin panel to revoke compromised licenses

## Support

For questions about this tool, contact your TheiaCast development team.

**Remember: This tool is confidential. Treat it like your database password.**
