# TheiaCast Payment & License Automation - Implementation Plan

**Last Updated:** 2025-12-27
**Status:** Planning Phase

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Secure Storage Best Practices](#secure-storage-best-practices)
3. [Stripe Integration Approach](#stripe-integration-approach)
4. [Implementation Steps](#implementation-steps)
5. [Cost Estimates](#cost-estimates)
6. [Security Best Practices](#security-best-practices)
7. [Recommended Tech Stack](#recommended-tech-stack)
8. [Code Examples](#code-examples)
9. [Testing Strategy](#testing-strategy)
10. [Resources & References](#resources--references)

---

## Architecture Overview

### High-Level Flow

```
Customer → theiacast.com → Stripe Checkout → Stripe Webhook → Azure Function →
→ License Generator → Database → Email License Key to Customer
```

### System Components

#### 1. Public Website (Azure App Service or Static Web App)
- Product pages with pricing tiers
- Stripe Checkout integration
- Customer enters installation key during purchase
- Success/cancel pages

#### 2. Stripe (Payment Processing)
- Hosted checkout pages (PCI compliant, no certificate needed)
- Webhook notifications for successful payments
- Handles all card data (we never touch it)
- Automatic 3D Secure (SCA) for fraud prevention

#### 3. Azure Function (Serverless Webhook Handler)
- Receives Stripe webhook events
- Validates webhook signatures
- Triggers license generation
- Sends email notifications
- Idempotent event processing

#### 4. License Generator (Modified Existing Tool)
- Refactored as class library/service
- Generates licenses using customer's installation key
- Accepts parameters: tier, installation key, expiration date
- Returns generated license key

#### 5. Azure SQL Database or PostgreSQL (Customer & License Storage)
- Stores customer details
- Stores generated licenses
- Links to Stripe customer IDs
- Webhook event tracking for idempotency

#### 6. Azure Key Vault (Secrets Management)
- Stores Stripe API keys (secret & publishable)
- Stores database connection strings
- Stores email service credentials
- FIPS 140-3 Level 3 HSM protection (Premium tier)

#### 7. Azure Communication Services or SendGrid (Email Delivery)
- Sends license keys to customers
- Transaction confirmations
- Renewal reminders

---

## Secure Storage Best Practices

### Azure Key Vault Configuration

**Secrets to Store:**
```
Stripe-SecretKey           = sk_live_xxxxxxxxxxxxxxxxxxxx
Stripe-PublishableKey      = pk_live_xxxxxxxxxxxxxxxxxxxx
Stripe-WebhookSecret       = whsec_xxxxxxxxxxxxxxxxxx
DatabaseConnectionString   = Host=...;Database=...
EmailService-ApiKey        = SG.xxxxxxxxxxxxxxxx
```

**Benefits:**
- ✅ Centralized secret management
- ✅ Automated secret rotation (recommended: every 60 days)
- ✅ RBAC (Role-Based Access Control)
- ✅ Audit logging for all secret access
- ✅ FIPS 140-3 Level 3 HSM protection (Premium tier)
- ✅ Integration with Managed Identity (no hardcoded credentials)

**Pricing:** ~$0.03 per 10,000 operations (Standard tier)

**Access Pattern:**
```csharp
// Using Azure.Security.KeyVault.Secrets
var client = new SecretClient(
    new Uri("https://theiacast-vault.vault.azure.net/"),
    new DefaultAzureCredential() // Uses Managed Identity
);

KeyVaultSecret secret = await client.GetSecretAsync("Stripe-SecretKey");
string stripeKey = secret.Value;
```

### Database Schema

#### Customers Table
```sql
CREATE TABLE Customers (
    Id SERIAL PRIMARY KEY,
    StripeCustomerId VARCHAR(255) UNIQUE NOT NULL,
    Email VARCHAR(255) NOT NULL,
    CompanyName VARCHAR(255),
    InstallationKey TEXT NOT NULL, -- Provided by customer during checkout
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_stripe_customer (StripeCustomerId),
    INDEX idx_email (Email)
);
```

#### PurchasedLicenses Table
```sql
CREATE TABLE PurchasedLicenses (
    Id SERIAL PRIMARY KEY,
    CustomerId INT REFERENCES Customers(Id),
    LicenseKey TEXT NOT NULL UNIQUE,
    Tier VARCHAR(50) NOT NULL, -- PRO-10, PRO-20, PRO-50, PRO-100
    MaxDevices INT NOT NULL,
    PurchaseDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ExpiresAt TIMESTAMP,
    StripePaymentIntentId VARCHAR(255) UNIQUE,
    StripeSubscriptionId VARCHAR(255), -- For recurring subscriptions (if used)
    Amount DECIMAL(10,2),
    Currency VARCHAR(10) DEFAULT 'USD',
    Status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, refunded
    Notes TEXT,

    INDEX idx_customer (CustomerId),
    INDEX idx_stripe_payment (StripePaymentIntentId),
    INDEX idx_stripe_subscription (StripeSubscriptionId),
    INDEX idx_status (Status)
);
```

#### WebhookEvents Table (Idempotency)
```sql
CREATE TABLE WebhookEvents (
    Id SERIAL PRIMARY KEY,
    StripeEventId VARCHAR(255) UNIQUE NOT NULL,
    EventType VARCHAR(100) NOT NULL,
    Processed BOOLEAN DEFAULT FALSE,
    ProcessedAt TIMESTAMP,
    RawPayload JSONB, -- Store full webhook payload for debugging
    ErrorMessage TEXT, -- If processing failed
    RetryCount INT DEFAULT 0,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_stripe_event (StripeEventId),
    INDEX idx_event_type (EventType),
    INDEX idx_processed (Processed)
);
```

**Security Measures:**
- ✅ Encrypt database at rest (Azure SQL/PostgreSQL transparent encryption)
- ✅ Use Azure Private Endpoints (no public internet access)
- ✅ Store license keys (customers need to see them)
- ❌ **NEVER** store credit card details (Stripe handles this)
- ✅ Hash/encrypt sensitive customer data if required by regulations

---

## Stripe Integration Approach

### Why Stripe Checkout?

**Advantages:**
- ✅ PCI compliant out-of-the-box (no compliance burden)
- ✅ Hosted by Stripe (no SSL cert worries)
- ✅ Supports 3D Secure (SCA) automatically
- ✅ Mobile-optimized UI
- ✅ Multiple payment methods (card, Apple Pay, Google Pay, Link)
- ✅ Automatic tax calculation (Stripe Tax addon)
- ✅ Conversion-optimized UI (A/B tested by Stripe)
- ✅ Faster implementation (hours vs weeks)

**Alternative:** Stripe Elements (custom UI)
- Use if you need complete design control
- More complex implementation
- Still PCI compliant with proper integration

### Stripe Products Configuration

**Recommended Pricing Tiers:**

| Product | Devices | Price | Stripe Product ID |
|---------|---------|-------|-------------------|
| PRO-10 | 10 (+ 3 free = 13 total) | $499/year | `prod_xxxxx` |
| PRO-20 | 20 (+ 3 free = 23 total) | $899/year | `prod_xxxxx` |
| PRO-50 | 50 (+ 3 free = 53 total) | $1,999/year | `prod_xxxxx` |
| PRO-100 | 100 (+ 3 free = 103 total) | $3,499/year | `prod_xxxxx` |
| Enterprise | Custom | Custom | Contact sales |

**Pricing Model Options:**

1. **One-Time Payment (Recommended for v1)**
   - Customer pays once, license valid for 1 year
   - Manual renewal process
   - Simpler implementation
   - Lower customer commitment

2. **Subscription (Recommended for v2)**
   - Auto-renewal every year
   - Recurring revenue
   - Automatic license extension
   - More complex webhook handling

### Webhook Events to Handle

**Critical Events:**

| Event | Purpose | Handler Action |
|-------|---------|----------------|
| `checkout.session.completed` | Payment successful | Generate & provision license |
| `invoice.paid` | Subscription renewal | Extend license expiration |
| `customer.subscription.deleted` | Customer cancelled | Deactivate license |
| `payment_intent.payment_failed` | Payment failed | Notify customer, grace period |
| `customer.subscription.updated` | Plan changed | Update license tier |

**Webhook Endpoint URL:**
```
https://theiacast-commerce.azurewebsites.net/api/StripeWebhook
```

**Required Configuration in Stripe Dashboard:**
1. Go to Developers → Webhooks
2. Add endpoint (URL above)
3. Select events to listen to
4. Copy webhook signing secret to Azure Key Vault

---

## Implementation Steps

### Phase 1: Infrastructure Setup (2-3 days)

#### 1.1 Azure Key Vault
```bash
# Create resource group (if not exists)
az group create --name theiacast-commerce-rg --location eastus

# Create Key Vault
az keyvault create \
  --name theiacast-vault \
  --resource-group theiacast-commerce-rg \
  --location eastus \
  --enable-rbac-authorization true

# Get your user principal ID
USER_ID=$(az ad signed-in-user show --query id -o tsv)

# Grant yourself Key Vault Secrets Officer role
az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee $USER_ID \
  --scope /subscriptions/{subscription-id}/resourceGroups/theiacast-commerce-rg/providers/Microsoft.KeyVault/vaults/theiacast-vault

# Add Stripe secrets (after getting them from Stripe Dashboard)
az keyvault secret set --vault-name theiacast-vault --name "Stripe-SecretKey" --value "sk_test_..."
az keyvault secret set --vault-name theiacast-vault --name "Stripe-PublishableKey" --value "pk_test_..."
az keyvault secret set --vault-name theiacast-vault --name "Stripe-WebhookSecret" --value "whsec_..."
```

#### 1.2 Database Setup
```bash
# Option A: Azure PostgreSQL Flexible Server (Recommended)
az postgres flexible-server create \
  --name theiacast-commerce-db \
  --resource-group theiacast-commerce-rg \
  --location eastus \
  --admin-user dbadmin \
  --admin-password {strong-password} \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15

# Enable encryption at rest (automatic)
# Configure firewall rules or Private Endpoint

# Store connection string in Key Vault
az keyvault secret set \
  --vault-name theiacast-vault \
  --name "DatabaseConnectionString" \
  --value "Host=theiacast-commerce-db.postgres.database.azure.com;Database=commerce;Username=dbadmin;Password={password};SSL Mode=Require"
```

```sql
-- Run migrations to create tables
-- Connect via psql or Azure Data Studio
\i database/migrations/001_customers_licenses.sql
```

#### 1.3 Azure Function App
```bash
# Create storage account (required for Functions)
az storage account create \
  --name theiacastfuncstorage \
  --resource-group theiacast-commerce-rg \
  --location eastus \
  --sku Standard_LRS

# Create Function App (Consumption plan)
az functionapp create \
  --name theiacast-commerce \
  --resource-group theiacast-commerce-rg \
  --consumption-plan-location eastus \
  --runtime dotnet \
  --runtime-version 8 \
  --functions-version 4 \
  --storage-account theiacastfuncstorage

# Enable Managed Identity
az functionapp identity assign \
  --name theiacast-commerce \
  --resource-group theiacast-commerce-rg

# Get Managed Identity principal ID
FUNCTION_IDENTITY=$(az functionapp identity show \
  --name theiacast-commerce \
  --resource-group theiacast-commerce-rg \
  --query principalId -o tsv)

# Grant Function App access to Key Vault
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $FUNCTION_IDENTITY \
  --scope /subscriptions/{subscription-id}/resourceGroups/theiacast-commerce-rg/providers/Microsoft.KeyVault/vaults/theiacast-vault

# Configure Function App settings
az functionapp config appsettings set \
  --name theiacast-commerce \
  --resource-group theiacast-commerce-rg \
  --settings "KeyVaultUrl=https://theiacast-vault.vault.azure.net/"
```

### Phase 2: Stripe Configuration (1 day)

#### 2.1 Create Stripe Products
1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Products
2. Click "Add product"
3. For each tier (PRO-10, PRO-20, PRO-50, PRO-100):
   - Name: `TheiaCast PRO-10`
   - Description: `10 device license + 3 free = 13 total devices`
   - Pricing: One-time payment or Recurring (annual)
   - Price: $499 (for PRO-10)
   - Save product ID

#### 2.2 Set up Webhook Endpoint
1. Deploy Azure Function (see Phase 3)
2. Go to Stripe Dashboard → Developers → Webhooks
3. Click "Add endpoint"
4. URL: `https://theiacast-commerce.azurewebsites.net/api/StripeWebhook`
5. Listen to events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
   - `payment_intent.payment_failed`
6. Copy webhook signing secret
7. Add to Key Vault:
   ```bash
   az keyvault secret set \
     --vault-name theiacast-vault \
     --name "Stripe-WebhookSecret" \
     --value "whsec_xxxxxxxxxxxxx"
   ```

### Phase 3: Build Azure Function Webhook Handler (2-3 days)

**Project Structure:**
```
TheiaCast.Commerce.Functions/
├── StripeWebhook.cs              # Main webhook handler
├── Services/
│   ├── KeyVaultService.cs        # Get secrets
│   ├── LicenseService.cs         # Generate licenses
│   ├── EmailService.cs           # Send emails
│   └── DatabaseService.cs        # DB operations
├── Models/
│   ├── Customer.cs
│   ├── PurchasedLicense.cs
│   └── WebhookEvent.cs
└── host.json
```

**See Code Examples section below for full implementation**

### Phase 4: Build Website Integration (3-5 days)

#### 4.1 Pricing Page (theiacast.com/pricing)
```html
<!DOCTYPE html>
<html>
<head>
    <title>TheiaCast Pricing</title>
    <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
    <div class="pricing-section">
        <div class="pricing-card">
            <h3>PRO-10</h3>
            <p>10 devices + 3 free = 13 total</p>
            <h2>$499/year</h2>
            <input type="text" id="installation-key-pro10" placeholder="Your Installation Key" />
            <button onclick="purchaseLicense('PRO-10', 'price_xxxxx', 'installation-key-pro10')">
                Purchase Now
            </button>
        </div>
        <!-- Repeat for PRO-20, PRO-50, PRO-100 -->
    </div>

    <script>
        const stripe = Stripe('pk_live_YOUR_PUBLISHABLE_KEY');

        async function purchaseLicense(tier, priceId, installKeyInputId) {
            const installationKey = document.getElementById(installKeyInputId).value;

            if (!installationKey || installationKey.length < 10) {
                alert('Please enter your installation key from your TheiaCast admin panel.');
                return;
            }

            // Call your backend to create checkout session
            const response = await fetch('https://theiacast-commerce.azurewebsites.net/api/CreateCheckoutSession', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier,
                    priceId,
                    installationKey
                })
            });

            const { sessionId } = await response.json();

            // Redirect to Stripe Checkout
            const { error } = await stripe.redirectToCheckout({ sessionId });
            if (error) {
                alert(error.message);
            }
        }
    </script>
</body>
</html>
```

#### 4.2 Success Page (theiacast.com/success)
```html
<!DOCTYPE html>
<html>
<head>
    <title>Payment Successful - TheiaCast</title>
</head>
<body>
    <div class="success-container">
        <h1>✅ Payment Successful!</h1>
        <p>Thank you for purchasing TheiaCast.</p>
        <p><strong>Your license key has been sent to your email.</strong></p>
        <p>Please check your inbox (and spam folder) for an email from noreply@theiacast.com</p>

        <h3>Next Steps:</h3>
        <ol>
            <li>Check your email for the license key</li>
            <li>Log in to your TheiaCast admin panel</li>
            <li>Go to the License page</li>
            <li>Enter your license key in the activation field</li>
            <li>Click "Activate License"</li>
        </ol>

        <a href="https://your-theiacast-instance.com/license" class="button">
            Go to License Activation
        </a>
    </div>
</body>
</html>
```

### Phase 5: License Generator Integration (2-3 days)

#### 5.1 Refactor Existing Generator
**Current:** CLI tool in `C:\Users\jimmy\source\repos\ThiacastLicenseGenerator\`

**Target:** Class library

```
TheiaCast.LicenseGenerator/
├── LicenseGenerator.cs
├── Models/
│   └── LicenseGenerationOptions.cs
└── TheiaCast.LicenseGenerator.csproj
```

**LicenseGenerator.cs:**
```csharp
namespace TheiaCast.LicenseGenerator;

public class LicenseGenerator
{
    public async Task<string> GenerateLicenseAsync(LicenseGenerationOptions options)
    {
        // Your existing license generation logic
        // Input: tier, installationKey, expiresAt
        // Output: license key (LK-1-PRO-10-random-checksum)

        var random = Convert.ToBase64String(RandomNumberGenerator.GetBytes(12))
            .TrimEnd('=')
            .Replace("+", "-")
            .Replace("/", "_");

        var keyPreChecksum = $"LK-1-{options.Tier.ToUpper()}-{random}";
        var checksum = ComputeChecksum(keyPreChecksum, options.InstallationKey).Substring(0, 4).ToUpper();

        return $"{keyPreChecksum}-{checksum}";
    }

    private string ComputeChecksum(string input, string hmacSecret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(hmacSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash);
    }
}

public class LicenseGenerationOptions
{
    public string Tier { get; set; } = string.Empty; // PRO-10, PRO-20, etc.
    public string InstallationKey { get; set; } = string.Empty;
    public DateTime? ExpiresAt { get; set; }
    public string? CompanyName { get; set; }
    public string? Notes { get; set; }
}
```

#### 5.2 Reference in Azure Function
```xml
<!-- TheiaCast.Commerce.Functions.csproj -->
<ItemGroup>
  <ProjectReference Include="..\TheiaCast.LicenseGenerator\TheiaCast.LicenseGenerator.csproj" />
</ItemGroup>
```

```csharp
// In StripeWebhook.cs
private async Task<string> GenerateLicense(string tier, string installationKey, int maxDevices)
{
    var generator = new LicenseGenerator();
    var options = new LicenseGenerationOptions
    {
        Tier = tier,
        InstallationKey = installationKey,
        ExpiresAt = DateTime.UtcNow.AddYears(1)
    };

    return await generator.GenerateLicenseAsync(options);
}
```

### Phase 6: Email Delivery Setup (1-2 days)

#### Option A: Azure Communication Services (Recommended)
```bash
# Create Email Communication Service
az communication create \
  --name theiacast-email \
  --resource-group theiacast-commerce-rg \
  --data-location UnitedStates

# Get connection string
az communication list-key \
  --name theiacast-email \
  --resource-group theiacast-commerce-rg

# Store in Key Vault
az keyvault secret set \
  --vault-name theiacast-vault \
  --name "EmailService-ConnectionString" \
  --value "endpoint=https://...;accesskey=..."
```

#### Option B: SendGrid (Easier Setup)
1. Sign up at [SendGrid](https://sendgrid.com)
2. Create API key
3. Add to Key Vault:
```bash
az keyvault secret set \
  --vault-name theiacast-vault \
  --name "SendGrid-ApiKey" \
  --value "SG.xxxxxxxxxxxxx"
```

#### Email Template
```csharp
private async Task SendLicenseEmail(string email, string licenseKey, string tier)
{
    var subject = "Your TheiaCast License Key";
    var body = $@"
        <html>
        <body style='font-family: Arial, sans-serif;'>
            <h2>Thank you for purchasing TheiaCast!</h2>

            <p>Your license has been successfully activated.</p>

            <div style='background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;'>
                <h3>License Details:</h3>
                <p><strong>License Key:</strong> <code style='background: white; padding: 5px; font-size: 14px;'>{licenseKey}</code></p>
                <p><strong>Tier:</strong> {tier}</p>
                <p><strong>Expires:</strong> {DateTime.UtcNow.AddYears(1):yyyy-MM-dd}</p>
            </div>

            <h3>Next Steps:</h3>
            <ol>
                <li>Log in to your TheiaCast admin panel</li>
                <li>Navigate to the <strong>License</strong> page</li>
                <li>Enter your license key in the activation field</li>
                <li>Click <strong>Activate License</strong></li>
            </ol>

            <p>Need help? Contact us at support@theiacast.com</p>

            <p style='color: #666; font-size: 12px;'>
                This license is tied to your installation key and cannot be transferred.
            </p>
        </body>
        </html>
    ";

    // Send using SendGrid or Azure Communication Services
    await emailService.SendEmailAsync(email, subject, body);
}
```

### Phase 7: Testing (2-3 days)

#### 7.1 Local Testing with Stripe CLI
```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local development
stripe listen --forward-to https://localhost:7071/api/StripeWebhook

# Trigger test events
stripe trigger checkout.session.completed
```

#### 7.2 Test Checklist

**Payment Flow:**
- [ ] Customer can view pricing page
- [ ] Customer enters installation key
- [ ] Checkout session created successfully
- [ ] Redirected to Stripe Checkout
- [ ] Can enter test card: `4242 4242 4242 4242`
- [ ] Payment succeeds
- [ ] Redirected to success page

**Webhook Processing:**
- [ ] Webhook received by Azure Function
- [ ] Signature verified successfully
- [ ] Customer record created in database
- [ ] License generated with correct tier
- [ ] License stored in PurchasedLicenses table
- [ ] Email sent to customer
- [ ] Event marked as processed (idempotency)

**License Activation:**
- [ ] Customer receives email with license key
- [ ] Customer can paste key in TheiaCast admin
- [ ] License activates successfully
- [ ] Device count updates to combined free + paid
- [ ] License expiration date displayed

**Edge Cases:**
- [ ] Duplicate webhook (should not double-process)
- [ ] Invalid webhook signature (should reject)
- [ ] Missing installation key (should fail gracefully)
- [ ] Email delivery failure (should log and retry)

#### 7.3 Stripe Test Cards
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
```

### Phase 8: Go Live (1 day)

#### 8.1 Pre-Launch Checklist
- [ ] Switch from test mode to live mode in Stripe
- [ ] Update Stripe API keys in Key Vault (live keys)
- [ ] Update webhook endpoint in Stripe (live mode)
- [ ] Test with real (small amount) transaction
- [ ] Set up Stripe Dashboard monitoring
- [ ] Configure email alerts for failed webhooks
- [ ] Set up Azure Application Insights for monitoring
- [ ] Review and test error handling
- [ ] Backup database before go-live

#### 8.2 Launch Day
1. Deploy final code to Azure Function
2. Update website with live Stripe publishable key
3. Test full flow end-to-end with real card (refund after)
4. Monitor webhook events in Stripe Dashboard
5. Monitor Azure Function logs
6. Monitor database for new records

#### 8.3 Post-Launch Monitoring
- Watch Stripe Dashboard for payments
- Monitor Azure Function failures/exceptions
- Check email delivery success rate
- Review customer support tickets
- Monitor database growth

---

## Cost Estimates

### Azure Services (Monthly)

| Service | Tier | Monthly Cost | Notes |
|---------|------|--------------|-------|
| **Azure Key Vault** | Standard | ~$3 | 10K operations/month |
| **Azure PostgreSQL** | Burstable B1ms | ~$12 | 1 vCore, 2GB RAM |
| **Azure Function App** | Consumption | ~$0-20 | First 1M executions free |
| **Azure Static Web App** | Free | $0 | For theiacast.com |
| **Azure Communication Services** | Pay-as-you-go | ~$0.50/1000 emails | Or SendGrid free tier |
| **Azure Application Insights** | Pay-as-you-go | ~$2-5 | 5GB data/month |
| **TOTAL Azure** | | **~$20-45/month** | Scales with usage |

### Stripe Fees (Per Transaction)

| Transaction Amount | Stripe Fee | You Receive |
|-------------------|------------|-------------|
| $499 (PRO-10) | $14.77 (2.9% + $0.30) | $484.23 |
| $899 (PRO-20) | $26.37 | $872.63 |
| $1,999 (PRO-50) | $58.27 | $1,940.73 |
| $3,499 (PRO-100) | $101.77 | $3,397.23 |

**Stripe Monthly Costs:**
- No monthly fee
- 2.9% + $0.30 per successful transaction
- Additional fees for international cards (~1%)
- Stripe Tax addon: 0.5% if used

### Total Cost Example (100 transactions/month)

**Scenario:** 50 PRO-10, 30 PRO-20, 15 PRO-50, 5 PRO-100

| Item | Cost |
|------|------|
| Azure Services | $40 |
| Stripe Fees | ~$1,500 |
| **Total** | **~$1,540/month** |
| **Revenue** | ~$76,000/month |
| **Net** | **~$74,460/month** |

**Note:** As volume grows, consider negotiating Stripe fees (2.7% + $0.30 at higher volumes)

---

## Security Best Practices

### Critical Security Measures

1. ✅ **Webhook Signature Verification**
   ```csharp
   Event stripeEvent = EventUtility.ConstructEvent(
       json,
       signatureHeader,
       webhookSecret
   );
   ```
   **Why:** Prevents attackers from sending fake payment events

2. ✅ **Idempotent Event Processing**
   ```csharp
   if (await IsEventProcessed(stripeEvent.Id))
   {
       return new OkResult(); // Already handled
   }
   ```
   **Why:** Stripe may send same event multiple times

3. ✅ **HTTPS Only**
   - All endpoints must use HTTPS
   - Azure App Service enforces this by default
   **Why:** Encrypted communication

4. ✅ **Azure Key Vault for Secrets**
   - Never hardcode API keys
   - Use Managed Identity
   **Why:** Prevents credential leaks

5. ✅ **Database Encryption**
   - At rest: Transparent Data Encryption (TDE)
   - In transit: SSL/TLS required
   **Why:** Protects customer data

6. ✅ **Private Endpoints for Database**
   - No public internet access
   - Only Azure services can connect
   **Why:** Reduces attack surface

7. ✅ **Audit Logging**
   - Key Vault access logs
   - Stripe Dashboard logs
   - Application Insights
   **Why:** Detect unauthorized access

8. ✅ **Managed Identity (No Hardcoded Credentials)**
   ```csharp
   var credential = new DefaultAzureCredential();
   ```
   **Why:** Azure handles authentication

9. ✅ **3D Secure (SCA)**
   - Enabled automatically with Stripe Checkout
   **Why:** Prevents fraud, required in EU

10. ✅ **PCI Compliance**
    - Stripe handles all card data
    - You never store card numbers
    **Why:** Legal requirement

### Additional Recommendations

- **Rate Limiting:** Azure API Management or Cloudflare
- **DDoS Protection:** Azure DDoS Protection Standard
- **Web Application Firewall:** Azure Front Door + WAF
- **Secrets Rotation:** Rotate Stripe API keys every 90 days
- **Least Privilege:** RBAC roles for team members
- **Backup & Disaster Recovery:** Automated database backups

---

## Recommended Tech Stack

### Website (theiacast.com)

**Option A: Azure Static Web Apps (Recommended)**
- Framework: Next.js, React, Blazor, or vanilla HTML/CSS/JS
- Cost: Free tier (perfect for marketing site)
- Features: Global CDN, SSL certificate, CI/CD from GitHub

**Option B: Azure App Service**
- Framework: ASP.NET Core MVC, Razor Pages
- Cost: ~$13/month (Basic tier)
- Features: More server-side control

### Webhook Handler

**Azure Functions (Consumption Plan)**
- Runtime: .NET 8 (C#)
- Trigger: HTTP Trigger
- Cost: First 1M executions free
- Scales automatically

### Database

**Azure PostgreSQL Flexible Server (Recommended)**
- You're already using PostgreSQL for TheiaCast
- Consistent technology stack
- Better pricing than Azure SQL for small workloads

**Alternative: Azure SQL Database**
- If you prefer SQL Server
- Slightly more expensive

### Secrets Management

**Azure Key Vault (Standard Tier)**
- Industry standard for secret management
- RBAC and audit logging
- Integrates with all Azure services

### Email Service

**Option A: Azure Communication Services Email (Recommended)**
- Native Azure integration
- Pay-as-you-go pricing
- High deliverability

**Option B: SendGrid**
- Free tier: 100 emails/day
- Well-documented
- Easy integration

### Payment Processing

**Stripe Checkout (Hosted)**
- PCI compliant
- Mobile optimized
- Conversion tested

### Monitoring

**Azure Application Insights**
- Distributed tracing
- Performance monitoring
- Exception tracking
- Real-time metrics

---

## Code Examples

### Azure Function: Webhook Handler

**StripeWebhook.cs**
```csharp
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Stripe;
using System;
using System.Linq;

namespace TheiaCast.Commerce.Functions;

public class StripeWebhook
{
    private readonly IKeyVaultService _keyVault;
    private readonly IDatabaseService _database;
    private readonly ILicenseService _licenseService;
    private readonly IEmailService _emailService;

    public StripeWebhook(
        IKeyVaultService keyVault,
        IDatabaseService database,
        ILicenseService licenseService,
        IEmailService emailService)
    {
        _keyVault = keyVault;
        _database = database;
        _licenseService = licenseService;
        _emailService = emailService;
    }

    [FunctionName("StripeWebhook")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
        ILogger log)
    {
        log.LogInformation("Stripe webhook received");

        // 1. Read request body
        var json = await new StreamReader(req.Body).ReadToEndAsync();
        var signatureHeader = req.Headers["Stripe-Signature"].FirstOrDefault();

        if (string.IsNullOrEmpty(signatureHeader))
        {
            log.LogWarning("Missing Stripe-Signature header");
            return new BadRequestResult();
        }

        // 2. Verify webhook signature (CRITICAL!)
        var webhookSecret = await _keyVault.GetSecretAsync("Stripe-WebhookSecret");
        Event stripeEvent;

        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                json,
                signatureHeader,
                webhookSecret
            );
        }
        catch (StripeException e)
        {
            log.LogError($"Webhook signature verification failed: {e.Message}");
            return new BadRequestResult();
        }

        log.LogInformation($"Event type: {stripeEvent.Type}, ID: {stripeEvent.Id}");

        // 3. Check if event already processed (IDEMPOTENCY)
        if (await _database.IsEventProcessedAsync(stripeEvent.Id))
        {
            log.LogInformation($"Event {stripeEvent.Id} already processed, skipping");
            return new OkResult();
        }

        // 4. Store event in database immediately
        await _database.StoreWebhookEventAsync(stripeEvent.Id, stripeEvent.Type, json);

        // 5. Handle different event types
        try
        {
            switch (stripeEvent.Type)
            {
                case Events.CheckoutSessionCompleted:
                    var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                    await HandleCheckoutSessionCompleted(session, log);
                    break;

                case Events.InvoicePaid:
                    var invoice = stripeEvent.Data.Object as Invoice;
                    await HandleInvoicePaid(invoice, log);
                    break;

                case Events.CustomerSubscriptionDeleted:
                    var subscription = stripeEvent.Data.Object as Subscription;
                    await HandleSubscriptionDeleted(subscription, log);
                    break;

                case Events.PaymentIntentPaymentFailed:
                    var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
                    await HandlePaymentFailed(paymentIntent, log);
                    break;

                default:
                    log.LogInformation($"Unhandled event type: {stripeEvent.Type}");
                    break;
            }

            // 6. Mark event as processed
            await _database.MarkEventProcessedAsync(stripeEvent.Id);

            return new OkResult();
        }
        catch (Exception ex)
        {
            log.LogError(ex, $"Error processing event {stripeEvent.Id}: {ex.Message}");
            await _database.RecordEventErrorAsync(stripeEvent.Id, ex.Message);

            // Return 500 so Stripe retries
            return new StatusCodeResult(500);
        }
    }

    private async Task HandleCheckoutSessionCompleted(Stripe.Checkout.Session session, ILogger log)
    {
        log.LogInformation($"Processing checkout session: {session.Id}");

        // Extract metadata
        var tier = session.Metadata["tier"];
        var installationKey = session.Metadata["installation_key"];
        var maxDevices = int.Parse(session.Metadata["max_devices"]);
        var customerEmail = session.CustomerDetails.Email;
        var companyName = session.CustomerDetails.Name;

        // 1. Create or update customer
        var customer = await _database.CreateOrUpdateCustomerAsync(
            session.CustomerId,
            customerEmail,
            companyName,
            installationKey
        );

        log.LogInformation($"Customer created/updated: {customer.Email}");

        // 2. Generate license
        var licenseKey = await _licenseService.GenerateLicenseAsync(
            tier,
            installationKey,
            maxDevices,
            DateTime.UtcNow.AddYears(1)
        );

        log.LogInformation($"License generated: {licenseKey}");

        // 3. Store license in database
        await _database.StorePurchasedLicenseAsync(new PurchasedLicense
        {
            CustomerId = customer.Id,
            LicenseKey = licenseKey,
            Tier = tier,
            MaxDevices = maxDevices,
            ExpiresAt = DateTime.UtcNow.AddYears(1),
            StripePaymentIntentId = session.PaymentIntentId,
            StripeSubscriptionId = session.SubscriptionId,
            Amount = session.AmountTotal / 100m, // Stripe uses cents
            Currency = session.Currency.ToUpper(),
            Status = "active"
        });

        log.LogInformation($"License stored in database");

        // 4. Send email to customer
        await _emailService.SendLicenseEmailAsync(
            customerEmail,
            licenseKey,
            tier,
            DateTime.UtcNow.AddYears(1)
        );

        log.LogInformation($"License email sent to {customerEmail}");
    }

    private async Task HandleInvoicePaid(Invoice invoice, ILogger log)
    {
        log.LogInformation($"Processing paid invoice: {invoice.Id}");

        // For subscription renewals
        var subscriptionId = invoice.SubscriptionId;
        var license = await _database.GetLicenseBySubscriptionIdAsync(subscriptionId);

        if (license != null)
        {
            // Extend license expiration by 1 year
            license.ExpiresAt = DateTime.UtcNow.AddYears(1);
            await _database.UpdateLicenseAsync(license);

            log.LogInformation($"License {license.LicenseKey} renewed until {license.ExpiresAt}");

            // Send renewal confirmation email
            await _emailService.SendRenewalConfirmationAsync(
                license.Customer.Email,
                license.LicenseKey,
                license.ExpiresAt.Value
            );
        }
    }

    private async Task HandleSubscriptionDeleted(Subscription subscription, ILogger log)
    {
        log.LogInformation($"Processing subscription deletion: {subscription.Id}");

        var license = await _database.GetLicenseBySubscriptionIdAsync(subscription.Id);

        if (license != null)
        {
            // Deactivate license
            license.Status = "cancelled";
            await _database.UpdateLicenseAsync(license);

            log.LogInformation($"License {license.LicenseKey} deactivated");

            // Optionally send cancellation email
            await _emailService.SendCancellationEmailAsync(license.Customer.Email);
        }
    }

    private async Task HandlePaymentFailed(PaymentIntent paymentIntent, ILogger log)
    {
        log.LogInformation($"Payment failed: {paymentIntent.Id}");

        // Send payment failed email to customer
        var customerEmail = paymentIntent.ReceiptEmail;
        if (!string.IsNullOrEmpty(customerEmail))
        {
            await _emailService.SendPaymentFailedEmailAsync(customerEmail);
        }
    }
}
```

### Azure Function: Create Checkout Session

**CreateCheckoutSession.cs**
```csharp
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Stripe.Checkout;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace TheiaCast.Commerce.Functions;

public class CreateCheckoutSession
{
    private readonly IKeyVaultService _keyVault;

    public CreateCheckoutSession(IKeyVaultService keyVault)
    {
        _keyVault = keyVault;
    }

    [FunctionName("CreateCheckoutSession")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)] HttpRequest req,
        ILogger log)
    {
        log.LogInformation("Creating checkout session");

        // Parse request
        var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
        var data = JsonConvert.DeserializeObject<CheckoutRequest>(requestBody);

        if (string.IsNullOrEmpty(data.InstallationKey) || data.InstallationKey.Length < 10)
        {
            return new BadRequestObjectResult(new { error = "Invalid installation key" });
        }

        // Get Stripe secret key from Key Vault
        var stripeKey = await _keyVault.GetSecretAsync("Stripe-SecretKey");
        StripeConfiguration.ApiKey = stripeKey;

        // Determine pricing and devices based on tier
        var (price, maxDevices) = data.Tier.ToUpper() switch
        {
            "PRO-10" => (49900L, 10),   // $499.00
            "PRO-20" => (89900L, 20),   // $899.00
            "PRO-50" => (199900L, 50),  // $1,999.00
            "PRO-100" => (349900L, 100),// $3,499.00
            _ => throw new System.ArgumentException("Invalid tier")
        };

        // Create Stripe Checkout Session
        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = new List<string> { "card" },
            LineItems = new List<SessionLineItemOptions>
            {
                new SessionLineItemOptions
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "usd",
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"TheiaCast {data.Tier.ToUpper()}",
                            Description = $"{maxDevices} devices + 3 free = {maxDevices + 3} total devices (annual license)"
                        },
                        UnitAmount = price,
                    },
                    Quantity = 1,
                },
            },
            Mode = "payment", // One-time payment (use "subscription" for recurring)
            SuccessUrl = "https://theiacast.com/success?session_id={CHECKOUT_SESSION_ID}",
            CancelUrl = "https://theiacast.com/pricing",
            CustomerEmail = data.Email, // Pre-fill email if provided
            Metadata = new Dictionary<string, string>
            {
                { "tier", data.Tier.ToUpper() },
                { "installation_key", data.InstallationKey },
                { "max_devices", maxDevices.ToString() }
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        log.LogInformation($"Checkout session created: {session.Id}");

        return new OkObjectResult(new { sessionId = session.Id });
    }
}

public class CheckoutRequest
{
    public string Tier { get; set; }
    public string InstallationKey { get; set; }
    public string Email { get; set; }
}
```

### Service: Key Vault Access

**KeyVaultService.cs**
```csharp
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;

namespace TheiaCast.Commerce.Functions.Services;

public interface IKeyVaultService
{
    Task<string> GetSecretAsync(string secretName);
}

public class KeyVaultService : IKeyVaultService
{
    private readonly SecretClient _client;

    public KeyVaultService(IConfiguration configuration)
    {
        var keyVaultUrl = configuration["KeyVaultUrl"]
            ?? "https://theiacast-vault.vault.azure.net/";

        _client = new SecretClient(
            new Uri(keyVaultUrl),
            new DefaultAzureCredential() // Uses Managed Identity
        );
    }

    public async Task<string> GetSecretAsync(string secretName)
    {
        KeyVaultSecret secret = await _client.GetSecretAsync(secretName);
        return secret.Value;
    }
}
```

### Service: License Generation

**LicenseService.cs**
```csharp
using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace TheiaCast.Commerce.Functions.Services;

public interface ILicenseService
{
    Task<string> GenerateLicenseAsync(string tier, string installationKey, int maxDevices, DateTime expiresAt);
}

public class LicenseService : ILicenseService
{
    public Task<string> GenerateLicenseAsync(string tier, string installationKey, int maxDevices, DateTime expiresAt)
    {
        // Generate random component
        var random = Convert.ToBase64String(RandomNumberGenerator.GetBytes(12))
            .TrimEnd('=')
            .Replace("+", "-")
            .Replace("/", "_");

        // Create key pre-checksum
        var keyPreChecksum = $"LK-1-{tier.ToUpper()}-{random}";

        // Compute checksum using installation key as HMAC secret
        var checksum = ComputeChecksum(keyPreChecksum, installationKey).Substring(0, 4).ToUpper();

        // Final license key
        var licenseKey = $"{keyPreChecksum}-{checksum}";

        return Task.FromResult(licenseKey);
    }

    private string ComputeChecksum(string input, string hmacSecret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(hmacSecret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash);
    }
}
```

### Service: Email Delivery

**EmailService.cs**
```csharp
using Azure.Communication.Email;
using Azure;
using System;
using System.Threading.Tasks;

namespace TheiaCast.Commerce.Functions.Services;

public interface IEmailService
{
    Task SendLicenseEmailAsync(string toEmail, string licenseKey, string tier, DateTime expiresAt);
    Task SendRenewalConfirmationAsync(string toEmail, string licenseKey, DateTime expiresAt);
    Task SendCancellationEmailAsync(string toEmail);
    Task SendPaymentFailedEmailAsync(string toEmail);
}

public class EmailService : IEmailService
{
    private readonly EmailClient _emailClient;
    private const string FromEmail = "noreply@theiacast.com";

    public EmailService(IKeyVaultService keyVault)
    {
        var connectionString = keyVault.GetSecretAsync("EmailService-ConnectionString").Result;
        _emailClient = new EmailClient(connectionString);
    }

    public async Task SendLicenseEmailAsync(string toEmail, string licenseKey, string tier, DateTime expiresAt)
    {
        var subject = "Your TheiaCast License Key";
        var htmlContent = $@"
            <html>
            <body style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;'>
                    <h1 style='color: white; margin: 0;'>TheiaCast</h1>
                    <p style='color: white; margin: 10px 0 0 0;'>Digital Signage Platform</p>
                </div>

                <div style='padding: 30px; background: white;'>
                    <h2 style='color: #333;'>Thank you for your purchase!</h2>

                    <p>Your TheiaCast license has been successfully generated and is ready to activate.</p>

                    <div style='background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea;'>
                        <h3 style='margin-top: 0; color: #667eea;'>License Details</h3>
                        <p style='margin: 10px 0;'><strong>License Key:</strong></p>
                        <code style='background: white; padding: 12px; font-size: 16px; display: block; border-radius: 4px; word-break: break-all;'>{licenseKey}</code>
                        <p style='margin: 10px 0;'><strong>Tier:</strong> {tier}</p>
                        <p style='margin: 10px 0;'><strong>Expires:</strong> {expiresAt:MMMM dd, yyyy}</p>
                    </div>

                    <h3 style='color: #333;'>Activation Instructions</h3>
                    <ol style='line-height: 1.8;'>
                        <li>Log in to your TheiaCast admin panel</li>
                        <li>Navigate to the <strong>License</strong> page in the sidebar</li>
                        <li>Copy the license key above</li>
                        <li>Paste it into the &quot;License Key&quot; field</li>
                        <li>Click <strong>Activate License</strong></li>
                    </ol>

                    <div style='background: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 8px;'>
                        <p style='margin: 0; color: #0066cc;'>
                            <strong>💡 Pro Tip:</strong> Your license is tied to your installation key and provides {tier.Replace("PRO-", "")} devices + 3 free = {int.Parse(tier.Replace("PRO-", "")) + 3} total devices.
                        </p>
                    </div>

                    <p style='color: #666; font-size: 14px; margin-top: 30px;'>
                        Need help? Contact us at <a href='mailto:support@theiacast.com' style='color: #667eea;'>support@theiacast.com</a>
                    </p>
                </div>

                <div style='background: #f5f5f5; padding: 20px; text-align: center;'>
                    <p style='color: #999; font-size: 12px; margin: 0;'>
                        © {DateTime.UtcNow.Year} TheiaCast. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
        ";

        var emailMessage = new EmailMessage(
            senderAddress: FromEmail,
            content: new EmailContent(subject)
            {
                Html = htmlContent
            },
            recipients: new EmailRecipients(new[] { new EmailAddress(toEmail) })
        );

        await _emailClient.SendAsync(WaitUntil.Started, emailMessage);
    }

    public async Task SendRenewalConfirmationAsync(string toEmail, string licenseKey, DateTime expiresAt)
    {
        var subject = "TheiaCast License Renewed";
        var htmlContent = $@"
            <html>
            <body style='font-family: Arial, sans-serif;'>
                <h2>License Renewal Confirmation</h2>
                <p>Your TheiaCast license has been successfully renewed!</p>
                <p><strong>License Key:</strong> {licenseKey}</p>
                <p><strong>New Expiration Date:</strong> {expiresAt:MMMM dd, yyyy}</p>
                <p>Thank you for continuing to use TheiaCast!</p>
            </body>
            </html>
        ";

        var emailMessage = new EmailMessage(
            senderAddress: FromEmail,
            content: new EmailContent(subject) { Html = htmlContent },
            recipients: new EmailRecipients(new[] { new EmailAddress(toEmail) })
        );

        await _emailClient.SendAsync(WaitUntil.Started, emailMessage);
    }

    public async Task SendCancellationEmailAsync(string toEmail)
    {
        var subject = "TheiaCast Subscription Cancelled";
        var htmlContent = @"
            <html>
            <body style='font-family: Arial, sans-serif;'>
                <h2>Subscription Cancelled</h2>
                <p>Your TheiaCast subscription has been cancelled.</p>
                <p>Your license will remain active until the end of the current billing period.</p>
                <p>We're sorry to see you go! If you have any feedback, please let us know at support@theiacast.com</p>
            </body>
            </html>
        ";

        var emailMessage = new EmailMessage(
            senderAddress: FromEmail,
            content: new EmailContent(subject) { Html = htmlContent },
            recipients: new EmailRecipients(new[] { new EmailAddress(toEmail) })
        );

        await _emailClient.SendAsync(WaitUntil.Started, emailMessage);
    }

    public async Task SendPaymentFailedEmailAsync(string toEmail)
    {
        var subject = "TheiaCast Payment Failed";
        var htmlContent = @"
            <html>
            <body style='font-family: Arial, sans-serif;'>
                <h2>Payment Failed</h2>
                <p>We were unable to process your payment for TheiaCast.</p>
                <p>Please update your payment method to continue using the service.</p>
                <p>If you have questions, contact us at support@theiacast.com</p>
            </body>
            </html>
        ";

        var emailMessage = new EmailMessage(
            senderAddress: FromEmail,
            content: new EmailContent(subject) { Html = htmlContent },
            recipients: new EmailRecipients(new[] { new EmailAddress(toEmail) })
        );

        await _emailClient.SendAsync(WaitUntil.Started, emailMessage);
    }
}
```

---

## Testing Strategy

### 1. Unit Tests

**Test License Generation:**
```csharp
[Fact]
public async Task GenerateLicense_Should_CreateValidKey()
{
    var service = new LicenseService();
    var key = await service.GenerateLicenseAsync(
        "PRO-10",
        "test-installation-key",
        10,
        DateTime.UtcNow.AddYears(1)
    );

    Assert.StartsWith("LK-1-PRO-10-", key);
    Assert.Matches(@"^LK-1-PRO-10-[A-Za-z0-9_-]+-[A-F0-9]{4}$", key);
}
```

**Test Webhook Signature Validation:**
```csharp
[Fact]
public void VerifyWebhookSignature_Should_ThrowOnInvalid()
{
    var json = "{\"type\":\"checkout.session.completed\"}";
    var invalidSignature = "invalid_signature";
    var webhookSecret = "whsec_test";

    Assert.Throws<StripeException>(() =>
        EventUtility.ConstructEvent(json, invalidSignature, webhookSecret)
    );
}
```

### 2. Integration Tests

**Test Checkout Session Creation:**
```csharp
[Fact]
public async Task CreateCheckoutSession_Should_ReturnSessionId()
{
    var request = new CheckoutRequest
    {
        Tier = "PRO-10",
        InstallationKey = "test-key-12345",
        Email = "test@example.com"
    };

    var response = await _httpClient.PostAsJsonAsync("/api/CreateCheckoutSession", request);

    Assert.True(response.IsSuccessStatusCode);
    var result = await response.Content.ReadFromJsonAsync<CheckoutResponse>();
    Assert.NotNull(result.SessionId);
    Assert.StartsWith("cs_", result.SessionId);
}
```

### 3. End-to-End Tests (Stripe Test Mode)

**Test Full Payment Flow:**
1. Create checkout session
2. Use Stripe CLI to trigger `checkout.session.completed` event
3. Verify webhook handler processes event
4. Verify customer created in database
5. Verify license generated and stored
6. Verify email sent (use test email service)

**Stripe CLI Commands:**
```bash
# Listen for webhooks
stripe listen --forward-to https://localhost:7071/api/StripeWebhook

# Trigger test event
stripe trigger checkout.session.completed

# Create real test checkout
stripe checkout sessions create \
  --success-url="https://example.com/success" \
  --line-items[][price]="price_xxxx" \
  --line-items[][quantity]=1 \
  --mode=payment
```

### 4. Performance Tests

**Webhook Handler Load Test:**
- Simulate 100 concurrent webhook requests
- Verify no duplicate processing (idempotency)
- Verify database connection pooling
- Target: <200ms response time

### 5. Security Tests

**Test Checklist:**
- [ ] Webhook signature verification blocks invalid signatures
- [ ] Key Vault access requires authentication
- [ ] Database requires SSL connection
- [ ] No secrets in source code or logs
- [ ] HTTPS enforced on all endpoints
- [ ] CORS properly configured

---

## Resources & References

### Official Documentation

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Azure Key Vault Documentation](https://learn.microsoft.com/en-us/azure/key-vault/)
- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Azure PostgreSQL Documentation](https://learn.microsoft.com/en-us/azure/postgresql/)

### Best Practices Articles

- [Stripe Integration with Azure API Management](https://github.com/microsoft/azure-api-management-monetization/blob/main/documentation/stripe-details.md)
- [Billing Management For Your Next SaaS Using Stripe And Azure Functions](https://www.smashingmagazine.com/2021/12/billing-management-saas-stripe-azure-functions/)
- [Stripe Payment Integration: Best Practices for 2025](https://www.ahhadigital.com/blog/stripe-payment-integration-best-practices)
- [Secure your Azure Key Vault secrets](https://learn.microsoft.com/en-us/azure/key-vault/secrets/secure-secrets)
- [Enable your SaaS users to access paid features with webhooks](https://dev.to/stripe/enable-your-saas-users-to-access-paid-features-with-webhooks-4n8f)
- [Stripe Webhooks: Complete Guide](https://www.magicbell.com/blog/stripe-webhooks-guide)
- [Integrate a SaaS business on Stripe](https://docs.stripe.com/saas)

### Tools & SDKs

- [Stripe .NET SDK](https://github.com/stripe/stripe-dotnet)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Azure SDK for .NET](https://github.com/Azure/azure-sdk-for-net)

### Community Resources

- [Stripe Stack Overflow](https://stackoverflow.com/questions/tagged/stripe-payments)
- [Azure Functions Samples](https://github.com/Azure/azure-functions-dotnet-worker)
- [Next.js SaaS Starter with Stripe](https://github.com/nextjs/saas-starter)

---

## Appendix: Decision Log

### One-Time Payment vs Subscription

**Decision:** Start with **one-time payment**, migrate to subscription in v2

**Reasoning:**
- ✅ Simpler implementation (fewer webhook events)
- ✅ Lower customer commitment (easier to sell)
- ✅ Faster time to market
- ✅ Can migrate to subscriptions later

**Trade-offs:**
- ❌ Manual renewal process (customers must re-purchase)
- ❌ No automatic recurring revenue
- ❌ Higher customer acquisition cost per year

### Azure PostgreSQL vs Azure SQL

**Decision:** **Azure PostgreSQL** (Flexible Server)

**Reasoning:**
- ✅ Already using PostgreSQL for TheiaCast backend
- ✅ Consistent technology stack
- ✅ Better pricing for small workloads
- ✅ Team familiarity

### Azure Communication Services vs SendGrid

**Decision:** Start with **SendGrid**, consider ACS later

**Reasoning:**
- ✅ Easier setup (API key vs domain verification)
- ✅ Free tier sufficient for initial volume
- ✅ Well-documented .NET SDK
- ✅ Can switch to ACS later if needed

### Stripe Checkout vs Stripe Elements

**Decision:** **Stripe Checkout** (hosted)

**Reasoning:**
- ✅ PCI compliant out-of-the-box
- ✅ Faster implementation
- ✅ Mobile-optimized
- ✅ Conversion-tested UI
- ✅ Less maintenance burden

---

## Next Actions

1. **Review this plan** with team/stakeholders
2. **Set up Stripe account** (if not done)
3. **Provision Azure resources** (Key Vault, Database, Function App)
4. **Build webhook handler** (Phase 3)
5. **Build pricing page** (Phase 4)
6. **Test with Stripe test mode**
7. **Go live** when ready

---

**Questions or Need Help?**

Contact: [Your Email]
Stripe Support: https://support.stripe.com
Azure Support: https://azure.microsoft.com/support
