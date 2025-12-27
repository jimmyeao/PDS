# TheiaCast License Key V2 Implementation

**Date:** 2025-12-27
**Version:** 2.0
**Status:** ✅ Complete - Ready for Testing

---

## Overview

Upgraded TheiaCast license key system from V1 (basic checksum validation) to **V2 (self-contained metadata encoding)**.

### Key Improvements

- ✅ **Self-contained license keys** - All metadata embedded in the key itself
- ✅ **Offline validation** - No database lookup needed to extract license details
- ✅ **Tamper-proof** - HMAC-SHA256 signature prevents modifications
- ✅ **Self-enforcing expiration** - Keys automatically disable when expired
- ✅ **Perpetual & expiring licenses** - Supports both license types
- ✅ **Company name tracking** - Embedded in license key
- ✅ **Backward compatible** - V1 licenses still supported

---

## License Key Format

### V1 Format (Old - Still Supported)
```
LK-1-PRO-10-xY9mKp3rT4u-BC8F
│  │   │         │        │
│  │   │         │        └─ Checksum (4 chars)
│  │   │         └────────── Random component
│  │   └──────────────────── Tier
│  └──────────────────────── Version
└─────────────────────────── Prefix
```

**Limitations:**
- No embedded metadata
- Tier and devices parsed from key format
- No expiration enforcement
- No company name

### V2 Format (New - Recommended)
```
LK-2-{COMPRESSED_BASE64_PAYLOAD}-{HMAC_SIG}
│  │         │                     │
│  │         │                     └─ HMAC signature (8 chars)
│  │         └───────────────────────── Compressed JSON payload
│  └─────────────────────────────────── Version
└────────────────────────────────────── Prefix
```

**Example:**
```
LK-2-H4sIAAAAAAAAA3VRUW_DIAz8K5HfWgHpuqbrQx-qfdjbpEqIQGlQCYQ5Tqaq-e-DSdcqm_piY5_vzvbgLQ-{signature}
```

**Embedded Payload (JSON before compression):**
```json
{
  "v": 2,                    // Version number
  "t": "PRO-10",             // Tier (PRO-10, PRO-20, etc.)
  "d": 10,                   // Max devices
  "c": "Acme Corporation",   // Company name (optional)
  "e": "2026-12-31",         // Expiry date (null for perpetual)
  "i": "2025-12-27"          // Issued date
}
```

---

## Changes Made

### 1. License Generator (`C:\Users\jimmy\source\repos\ThiacastLicenseGenerator\Program.cs`)

**Added:**
- `System.Text.Json` namespace for JSON serialization
- `System.IO.Compression` namespace for GZip compression
- `LICENSE_VERSION = 2` constant

**New Methods:**
- `GenerateLicenseKey()` - Creates V2 keys with embedded metadata
- `CompressString()` - GZip compresses JSON payload
- `DecompressString()` - Decompresses payload
- `ComputeHmacSignature()` - Creates tamper-proof signature
- `DecodeLicenseKey()` - Verifies and decodes V2 keys

**New Class:**
```csharp
class LicensePayload
{
    public int v { get; set; }        // Version
    public string t { get; set; }     // Tier
    public int d { get; set; }        // Max devices
    public string? c { get; set; }    // Company name
    public string? e { get; set; }    // Expiry date (YYYY-MM-DD)
    public string i { get; set; }     // Issued date
}
```

**Updated:**
- Method signature: `GenerateLicenseKey(tier, maxDevices, companyName, expiresAt, hmacSecret)`
- Added license verification display after generation
- Shows decoded payload to confirm encoding works

### 2. Backend API (`src/TheiaCast.Api/LicenseService.cs`)

**Added:**
- `System.Text.Json` namespace
- `System.IO.Compression` namespace
- `DecodeLicenseKeyAsync()` method to interface and implementation
- `ComputeHmacSignature()` helper method
- `DecompressString()` helper method
- `LicensePayload` class with helper methods:
  - `GetExpiryDate()` - Parses expiry date
  - `GetIssuedDate()` - Parses issue date
  - `IsExpired()` - Checks if license has expired
  - `IsPerpetual()` - Checks if license is perpetual

**Updated:**
- `ValidateLicenseAsync()` - Now decodes V2 licenses and checks embedded expiration
- Auto-deactivates expired V2 licenses
- Backward compatible with V1 licenses

### 3. Activation Endpoint (`src/TheiaCast.Api/Program.cs` line 758)

**Updated `/license/activate` endpoint:**

Before:
```csharp
// Parsed tier from key format only
var tier = parts[2]; // PRO, ENTERPRISE, etc.
```

After:
```csharp
// Detects version and decodes metadata
var version = int.Parse(parts[1]);
var payload = await svc.DecodeLicenseKeyAsync(dto.LicenseKey);

if (payload != null && version == 2) {
    // V2: Extract from payload
    tier = payload.t;
    maxDevices = payload.d;
    companyName = payload.c;
    expiresAt = payload.GetExpiryDate();
} else if (version == 1) {
    // V1: Parse from key format
    tier = parts[2];
    // ...
}
```

**New Features:**
- ✅ Detects V1 vs V2 licenses
- ✅ Extracts metadata from V2 license keys
- ✅ Populates database with company name and expiry
- ✅ Validates expiration before activation
- ✅ Logs detailed activation info

---

## How It Works

### License Generation Flow

1. **Vendor runs generator** with customer details:
   ```bash
   cd C:\Users\jimmy\source\repos\ThiacastLicenseGenerator
   dotnet run
   ```

2. **Generator prompts for:**
   - HMAC Secret (customer's installation key)
   - Tier (PRO-10, PRO-20, etc.)
   - Company Name (optional)
   - Expiration Date (or leave blank for perpetual)
   - Notes (optional)

3. **Generator creates payload:**
   ```json
   {
     "v": 2,
     "t": "PRO-10",
     "d": 10,
     "c": "Acme Corp",
     "e": "2026-12-31",
     "i": "2025-12-27"
   }
   ```

4. **Payload is compressed and encoded:**
   - JSON → GZip → Base64 → URL-safe

5. **HMAC signature computed:**
   - HMAC-SHA256 over encoded payload
   - Uses customer's installation key as secret
   - Truncated to 8 characters

6. **Final key assembled:**
   ```
   LK-2-{encoded}-{signature}
   ```

7. **Generator displays:**
   - License key
   - Verification (decodes key to confirm)
   - SQL INSERT statement (for manual activation)
   - Customer delivery instructions

### License Activation Flow

1. **Customer receives license key** via email

2. **Customer pastes key** in TheiaCast admin UI (License page)

3. **Backend decodes and validates:**
   ```csharp
   var payload = await DecodeLicenseKeyAsync(licenseKey);

   // Check signature
   if (signature != expectedSignature) {
       return "Tampered!";
   }

   // Check expiration
   if (payload.IsExpired()) {
       return "Expired!";
   }

   // Extract metadata
   tier = payload.t;
   maxDevices = payload.d;
   companyName = payload.c;
   expiresAt = payload.GetExpiryDate();
   ```

4. **License record created** in database with all metadata

5. **License activated** and assigned to devices

### Automatic Expiration Enforcement

**During `ValidateLicenseAsync()`:**
```csharp
// Check database expiration
if (license.ExpiresAt.HasValue && license.ExpiresAt.Value < DateTime.UtcNow) {
    return Invalid("Expired");
}

// ALSO check embedded expiration (V2 self-enforcement)
var payload = await DecodeLicenseKeyAsync(license.Key);
if (payload != null && payload.IsExpired()) {
    license.IsActive = false;  // Auto-deactivate
    await db.SaveChangesAsync();
    return Invalid($"Expired on {payload.e}");
}
```

**When devices connect:**
- Backend calls `ValidateLicenseAsync()` for their assigned license
- If expired, license is auto-deactivated
- Devices are blocked from registering or continuing operation

---

## Testing

### 1. Generate a V2 License

```bash
cd C:\Users\jimmy\source\repos\ThiacastLicenseGenerator
dotnet run
```

**Interactive Mode Example:**
```
Enter HMAC Secret: LMBM3oz6azq8lXQKxulptpzEyyHnat6eyBGCeJJE54Oq1f37O/NgcZKNBBaqr2BN
Select License Tier: 1 (Pro-10)
Company Name: Acme Corporation
Expiration Date: 2026-12-31
Notes: Annual subscription
```

**Output:**
```
License Key: LK-2-H4sIAAAAAAAAA...{encoded}...-Ab7D2e_f
```

**Verification Output:**
```
✓ License key successfully decoded and verified!
  Decoded Tier: PRO-10
  Decoded Max Devices: 10
  Decoded Company: Acme Corporation
  Decoded Expiry: 2026-12-31
  Issued Date: 2025-12-27
```

### 2. Generate a Perpetual License

Same process, but **leave expiration date blank**.

**Output:**
```
✓ License key successfully decoded and verified!
  Decoded Tier: PRO-10
  Decoded Max Devices: 10
  Decoded Company: Acme Corporation
  Decoded Expiry: Perpetual
  Issued Date: 2025-12-27
```

### 3. Activate License in TheiaCast

1. Go to `https://your-theiacast-instance.com/license`
2. Paste license key
3. Click "Activate License"

**Expected Result:**
- ✅ License activates successfully
- ✅ Tier shows PRO-10
- ✅ Max devices shows 13 (3 free + 10 paid)
- ✅ Company name displayed (if provided)
- ✅ Expiration date shown (or "Perpetual")

### 4. Test Expiration Enforcement

**Manual Test:**
1. Generate license with `--batch` mode:
   ```bash
   dotnet run -- --batch PRO-10 "Test Co" 2025-01-01 "Expired test" "installation-key"
   ```
2. Activate the license
3. Try to add devices
4. Backend should block with "License expired on 2025-01-01"

### 5. Test V1 Backward Compatibility

1. Use an old V1 license key: `LK-1-PRO-10-xY9mKp3rT4u-BC8F`
2. Activate it
3. Should still work (parsed from key format, no metadata)

---

## Migration Path

### For Existing V1 Licenses

**No action required** - V1 licenses continue to work:
- Validation still checks V1 format
- Tier parsed from key format
- No company name or embedded expiration
- Expiration only from database field

### Issuing New Licenses

**Use V2 format** for all new licenses:
- Run updated generator (builds completed successfully)
- All metadata embedded
- Self-enforcing expiration
- Better customer experience

### Upgrading V1 to V2

**Cannot convert existing V1 keys to V2** - must issue new V2 license:
1. Customer provides installation key
2. Generate new V2 license with expiration
3. Customer activates new V2 license
4. Old V1 license can be revoked

---

## Frontend Updates (Recommended - Not Yet Implemented)

### Display Decoded License Info

**LicensePage.tsx - Add Decoded Info Section:**

```tsx
// Fetch decoded payload
const [decodedLicense, setDecodedLicense] = useState<LicensePayload | null>(null);

useEffect(() => {
  async function fetchDecoded() {
    const response = await fetch('/api/license/decode');
    const payload = await response.json();
    setDecodedLicense(payload);
  }
  fetchDecoded();
}, []);

// Display in UI
{decodedLicense && (
  <div className="decoded-license-info">
    <h3>License Details</h3>
    <p>Company: {decodedLicense.c || 'N/A'}</p>
    <p>Tier: {decodedLicense.t}</p>
    <p>Max Devices: {decodedLicense.d}</p>
    <p>Issued: {decodedLicense.i}</p>
    <p>Expires: {decodedLicense.e || 'Perpetual'}</p>
    {decodedLicense.e && (
      <p className={decodedLicense.IsExpired() ? 'text-red-600' : 'text-green-600'}>
        {decodedLicense.IsExpired() ? '❌ EXPIRED' : '✅ ACTIVE'}
      </p>
    )}
  </div>
)}
```

### Add `/api/license/decode` Endpoint

**Program.cs:**
```csharp
app.MapGet("/license/decode", async (ILicenseService svc, PdsDbContext db) =>
{
    var paidLicense = await db.Licenses
        .Where(l => l.IsActive && l.Tier != "free")
        .OrderByDescending(l => l.MaxDevices)
        .FirstOrDefaultAsync();

    if (paidLicense == null)
        return Results.NotFound();

    var payload = await svc.DecodeLicenseKeyAsync(paidLicense.Key);
    return Results.Ok(payload);
}).RequireAuthorization();
```

---

## Security Considerations

### Tamper Protection

**HMAC-SHA256 Signature:**
- Computed over entire payload
- Uses customer's unique installation key
- Truncated to 8 characters for readability
- Any modification invalidates signature

**Validation:**
```csharp
var expectedSignature = ComputeHmacSignature(encoded, hmacSecret);
if (signature != expectedSignature) {
    return "Tampered!";
}
```

### Expiration Cannot Be Extended

- Expiration date is in signed payload
- Changing expiry breaks HMAC signature
- Customer cannot modify their own license
- Only vendor can issue new licenses

### Installation Key Security

**Critical:** Keep installation keys secret
- ✅ Stored securely in Azure Key Vault (Stripe integration)
- ✅ Never committed to Git
- ✅ Unique per customer installation
- ❌ **Never shared publicly**

---

## Advantages Over V1

| Feature | V1 | V2 |
|---------|----|----|
| **Metadata Storage** | Database only | Embedded in key |
| **Offline Validation** | ❌ No | ✅ Yes |
| **Company Name** | ❌ No | ✅ Yes |
| **Expiration** | Database only | ✅ Self-enforcing |
| **Perpetual Licenses** | Implicit | ✅ Explicit |
| **Issue Date** | Database CreatedAt | ✅ Embedded |
| **Tamper Protection** | Checksum only | ✅ HMAC-SHA256 |
| **Decoding** | Parse format | ✅ JSON payload |
| **Future Extensibility** | Limited | ✅ Add fields easily |

---

## Future Enhancements

### Possible V3 Features

1. **Multiple Device Pools**
   - Assign devices to different pools
   - Different expiration per pool

2. **Feature Flags**
   - Encode enabled features in payload
   - e.g., `"f": ["streaming", "analytics", "api"]`

3. **Usage Limits**
   - Bandwidth caps
   - API request limits
   - Storage quotas

4. **Encrypted Payload**
   - AES encryption before compression
   - Additional layer of security

5. **Shorter Keys**
   - Use Protocol Buffers instead of JSON
   - 30-40% smaller payloads

---

## Build Status

✅ **License Generator:** `C:\Users\jimmy\source\repos\ThiacastLicenseGenerator\`
```
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

✅ **TheiaCast API:** `src/TheiaCast.Api/`
```
Build succeeded.
    1 Warning(s)  (nullable reference - cosmetic)
    0 Error(s)
```

---

## Commands

### Generate License (Interactive)
```bash
cd C:\Users\jimmy\source\repos\ThiacastLicenseGenerator
dotnet run
```

### Generate License (Batch Mode)
```bash
dotnet run -- --batch PRO-10 "Company Name" 2026-12-31 "Notes" "HMAC_SECRET"
```

### Test Generator
```bash
dotnet build
dotnet run
# Select tier, enter test data
# Verify decoded output matches input
```

### Deploy Backend
```bash
cd src/TheiaCast.Api
dotnet build
dotnet publish -c Release
# Deploy to server and restart
```

---

## Documentation Files

1. **LICENSE-V2-IMPLEMENTATION.md** (this file)
2. **STRIPE-INTEGRATION-PLAN.md** - Payment automation plan
3. **SETUP.md** - Installation and licensing guide
4. **CLAUDE.md** - Project development log

---

## Support

**Questions or Issues:**
- License generator issues: Check `ThiacastLicenseGenerator\CLAUDE.md`
- Backend validation issues: Check `src/TheiaCast.Api/LicenseService.cs`
- Frontend display issues: Update `frontend/src/pages/LicensePage.tsx`

**Testing Checklist:**
- [ ] Generate V2 perpetual license
- [ ] Generate V2 expiring license
- [ ] Activate V2 license in UI
- [ ] Verify metadata displays correctly
- [ ] Test expiration enforcement
- [ ] Test V1 backward compatibility
- [ ] Verify auto-deactivation of expired licenses
- [ ] Test tamper protection (modify key)

---

**Status:** ✅ **Ready for Production Testing**

All code changes complete and builds successful. Frontend updates (display decoded info) are recommended but optional - the backend fully supports V2 licenses now.
