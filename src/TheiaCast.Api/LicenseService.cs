using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using TheiaCast.Api.Contracts;

namespace TheiaCast.Api;

public interface ILicenseService
{
    // Generation
    Task<License> GenerateLicenseAsync(string tier, int maxDevices, string? companyName, DateTime? expiresAt);

    // Activation
    Task<License> ActivateLicenseAsync(string licenseKey, int deviceId);

    // Validation
    Task<LicenseValidationResult> ValidateLicenseAsync(int licenseId);
    Task<bool> CanAddDeviceAsync(int? licenseId);

    // Management
    Task<IEnumerable<License>> GetAllLicensesAsync();
    Task<License?> GetLicenseByIdAsync(int id);
    Task<License?> GetLicenseByKeyAsync(string key);
    Task RevokeLicenseAsync(int id);
    Task UpdateLicenseAsync(int id, UpdateLicenseDto dto);

    // Grace Period
    Task CheckAndEnforceGracePeriodAsync();
}

public record LicenseValidationResult(
    bool IsValid,
    string? Reason,
    bool IsInGracePeriod,
    DateTime? GracePeriodEndsAt
);

public class LicenseService : ILicenseService
{
    private readonly PdsDbContext _db;
    private readonly ILogger<LicenseService> _logger;
    private readonly IConfiguration _config;
    private readonly ILogService _logService;

    public LicenseService(
        PdsDbContext db,
        ILogger<LicenseService> logger,
        IConfiguration config,
        ILogService logService)
    {
        _db = db;
        _logger = logger;
        _config = config;
        _logService = logService;
    }

    public async Task<License> GenerateLicenseAsync(string tier, int maxDevices, string? companyName, DateTime? expiresAt)
    {
        var key = await GenerateLicenseKeyAsync(tier);
        var keyHash = await ComputeLicenseKeyHashAsync(key);

        var license = new License
        {
            Key = key,
            KeyHash = keyHash,
            Tier = tier,
            MaxDevices = maxDevices,
            CompanyName = companyName,
            ExpiresAt = expiresAt,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Licenses.Add(license);
        await _db.SaveChangesAsync();

        await _logService.AddLogAsync("Info", $"License generated: {tier} - {maxDevices} devices", null, "LicenseService");

        return license;
    }

    public async Task<License> ActivateLicenseAsync(string licenseKey, int deviceId)
    {
        var keyHash = await ComputeLicenseKeyHashAsync(licenseKey);
        var license = await _db.Licenses.FirstOrDefaultAsync(l => l.KeyHash == keyHash);

        if (license == null)
        {
            throw new InvalidOperationException("Invalid license key");
        }

        if (!license.IsActive)
        {
            throw new InvalidOperationException("License is not active");
        }

        if (license.ExpiresAt.HasValue && license.ExpiresAt.Value < DateTime.UtcNow)
        {
            throw new InvalidOperationException("License has expired");
        }

        var device = await _db.Devices.FindAsync(deviceId);
        if (device == null)
        {
            throw new InvalidOperationException("Device not found");
        }

        // Check if device already has a license
        if (device.LicenseId.HasValue)
        {
            throw new InvalidOperationException("Device already has a license assigned");
        }

        // Check if license has capacity
        var currentDeviceCount = await _db.Devices.CountAsync(d => d.LicenseId == license.Id);
        if (currentDeviceCount >= license.MaxDevices)
        {
            throw new InvalidOperationException("License has reached maximum device limit");
        }

        // Assign license to device
        device.LicenseId = license.Id;
        device.LicenseActivatedAt = DateTime.UtcNow;
        license.CurrentDeviceCount = currentDeviceCount + 1;

        if (!license.ActivatedAt.HasValue)
        {
            license.ActivatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        await _logService.AddLogAsync("Info", $"License activated on device {device.DeviceId}", device.DeviceId, "LicenseService");

        return license;
    }

    public async Task<LicenseValidationResult> ValidateLicenseAsync(int licenseId)
    {
        var license = await _db.Licenses.FindAsync(licenseId);
        if (license == null)
        {
            return new LicenseValidationResult(false, "License not found", false, null);
        }

        if (!license.IsActive)
        {
            return new LicenseValidationResult(false, "License is not active", false, null);
        }

        if (license.ExpiresAt.HasValue && license.ExpiresAt.Value < DateTime.UtcNow)
        {
            return new LicenseValidationResult(false, "License has expired", false, null);
        }

        var deviceCount = await _db.Devices.CountAsync(d => d.LicenseId == licenseId);

        if (deviceCount > license.MaxDevices)
        {
            // Check for grace period
            var violation = await _db.LicenseViolations
                .Where(v => v.LicenseId == licenseId && !v.Resolved)
                .OrderByDescending(v => v.DetectedAt)
                .FirstOrDefaultAsync();

            if (violation != null)
            {
                var isInGracePeriod = DateTime.UtcNow <= violation.GracePeriodEndsAt;
                return new LicenseValidationResult(
                    isInGracePeriod,
                    $"Device limit exceeded ({deviceCount}/{license.MaxDevices})",
                    isInGracePeriod,
                    violation.GracePeriodEndsAt
                );
            }

            return new LicenseValidationResult(false, $"Device limit exceeded ({deviceCount}/{license.MaxDevices})", false, null);
        }

        return new LicenseValidationResult(true, null, false, null);
    }

    public async Task<bool> CanAddDeviceAsync(int? licenseId)
    {
        if (!licenseId.HasValue)
        {
            return true; // No license restriction
        }

        var validation = await ValidateLicenseAsync(licenseId.Value);
        return validation.IsValid || validation.IsInGracePeriod;
    }

    public async Task<IEnumerable<License>> GetAllLicensesAsync()
    {
        return await _db.Licenses.OrderByDescending(l => l.CreatedAt).ToListAsync();
    }

    public async Task<License?> GetLicenseByIdAsync(int id)
    {
        return await _db.Licenses.FindAsync(id);
    }

    public async Task<License?> GetLicenseByKeyAsync(string key)
    {
        var keyHash = await ComputeLicenseKeyHashAsync(key);
        return await _db.Licenses.FirstOrDefaultAsync(l => l.KeyHash == keyHash);
    }

    public async Task RevokeLicenseAsync(int id)
    {
        var license = await _db.Licenses.FindAsync(id);
        if (license == null)
        {
            throw new InvalidOperationException("License not found");
        }

        // Prevent deletion of free license (it's permanent)
        if (license.Tier == "free")
        {
            throw new InvalidOperationException("Cannot revoke the free license");
        }

        // Find the free license to reassign devices
        var freeLicense = await _db.Licenses.FirstOrDefaultAsync(l => l.Tier == "free");
        if (freeLicense == null)
        {
            throw new InvalidOperationException("Free license not found - cannot reassign devices");
        }

        // Reassign all devices from this license to the free license
        var devicesUsingLicense = await _db.Devices.Where(d => d.LicenseId == id).ToListAsync();
        foreach (var device in devicesUsingLicense)
        {
            device.LicenseId = freeLicense.Id;
            device.LicenseActivatedAt = DateTime.UtcNow;
        }

        // Update device counts
        license.CurrentDeviceCount = 0;
        freeLicense.CurrentDeviceCount = await _db.Devices.CountAsync(d => d.LicenseId == freeLicense.Id);

        // Delete the license from the database
        _db.Licenses.Remove(license);
        await _db.SaveChangesAsync();

        await _logService.AddLogAsync("Warning",
            $"License deleted: {license.Tier} ({license.Key}). {devicesUsingLicense.Count} devices reassigned to free license.",
            null, "LicenseService");
    }

    public async Task UpdateLicenseAsync(int id, UpdateLicenseDto dto)
    {
        var license = await _db.Licenses.FindAsync(id);
        if (license == null)
        {
            throw new InvalidOperationException("License not found");
        }

        if (dto.IsActive.HasValue)
        {
            license.IsActive = dto.IsActive.Value;
        }

        if (dto.ExpiresAt.HasValue)
        {
            license.ExpiresAt = dto.ExpiresAt.Value;
        }

        if (dto.Notes != null)
        {
            license.Notes = dto.Notes;
        }

        await _db.SaveChangesAsync();

        await _logService.AddLogAsync("Info", $"License updated: {license.Tier}", null, "LicenseService");
    }

    public async Task CheckAndEnforceGracePeriodAsync()
    {
        var licenses = await _db.Licenses.Where(l => l.IsActive).ToListAsync();

        foreach (var license in licenses)
        {
            var deviceCount = await _db.Devices.CountAsync(d => d.LicenseId == license.Id);

            if (deviceCount > license.MaxDevices)
            {
                // Check if violation already exists
                var existingViolation = await _db.LicenseViolations
                    .Where(v => v.LicenseId == license.Id && !v.Resolved)
                    .OrderByDescending(v => v.DetectedAt)
                    .FirstOrDefaultAsync();

                if (existingViolation == null)
                {
                    // Create new violation with 7-day grace period
                    var gracePeriodDays = _config.GetValue<int>("License:GracePeriodDays", 7);
                    var violation = new LicenseViolation
                    {
                        LicenseId = license.Id,
                        ViolationType = "over_limit",
                        DeviceCount = deviceCount,
                        MaxAllowed = license.MaxDevices,
                        DetectedAt = DateTime.UtcNow,
                        GracePeriodEndsAt = DateTime.UtcNow.AddDays(gracePeriodDays)
                    };
                    _db.LicenseViolations.Add(violation);

                    await _logService.AddLogAsync("Warning",
                        $"License {license.Id} exceeded device limit: {deviceCount}/{license.MaxDevices}. Grace period: {gracePeriodDays} days",
                        null, "LicenseService");
                }
                else if (DateTime.UtcNow > existingViolation.GracePeriodEndsAt)
                {
                    // Grace period expired - enforce hard limit
                    license.IsActive = false;
                    existingViolation.Resolved = true;

                    await _logService.AddLogAsync("Warning",
                        $"License {license.Id} deactivated: grace period expired", null, "LicenseService");
                }
            }
            else
            {
                // Device count is within limit - resolve any existing violations
                var violations = await _db.LicenseViolations
                    .Where(v => v.LicenseId == license.Id && !v.Resolved)
                    .ToListAsync();

                foreach (var violation in violations)
                {
                    violation.Resolved = true;
                }

                if (violations.Any())
                {
                    await _logService.AddLogAsync("Info",
                        $"License {license.Id} violations resolved: device count within limit", null, "LicenseService");
                }
            }

            // Update current device count
            license.CurrentDeviceCount = deviceCount;
            license.LastValidatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }

    private async Task<string> GenerateLicenseKeyAsync(string tier)
    {
        var random = Convert.ToBase64String(RandomNumberGenerator.GetBytes(12))
            .TrimEnd('=')
            .Replace("+", "-")
            .Replace("/", "_");

        var keyPreChecksum = $"LK-1-{tier.ToUpper()}-{random}";
        var checksum = (await ComputeChecksumAsync(keyPreChecksum)).Substring(0, 4).ToUpper();

        return $"{keyPreChecksum}-{checksum}";
    }

    private async Task<string> ComputeChecksumAsync(string input)
    {
        var secret = await GetInstallationKeyAsync();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash);
    }

    private async Task<string> ComputeLicenseKeyHashAsync(string key)
    {
        var secret = await GetInstallationKeyAsync();
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hash).ToLower();
    }

    private async Task<string> GetInstallationKeyAsync()
    {
        var installationKey = await _db.AppSettings
            .FirstOrDefaultAsync(s => s.Key == "InstallationKey");

        if (installationKey == null)
        {
            throw new InvalidOperationException("Installation key not found. Please restart the backend to generate one.");
        }

        return installationKey.Value;
    }
}
