using Microsoft.EntityFrameworkCore;
using TheiaCast.Api.Contracts;

namespace TheiaCast.Api;

public interface IDeviceService
{
    Task<object> CreateAsync(CreateDeviceDto dto);
    Task<IEnumerable<object>> FindAllAsync();
    Task<object?> FindOneAsync(int id);
    Task<IEnumerable<DeviceLogDto>> GetLogsAsync(int id, int limit);
    Task<object> UpdateAsync(int id, UpdateDeviceDto dto);
    Task RemoveAsync(int id);
    Task<object> GetTokenAsync(int id);
    Task<object> RotateTokenAsync(int id);
}

public class DeviceService : IDeviceService
{
    private readonly PdsDbContext _db;
    private readonly ILogService _logService;
    private readonly ILicenseService _licenseService;

    public DeviceService(PdsDbContext db, ILogService logService, ILicenseService licenseService)
    {
        _db = db;
        _logService = logService;
        _licenseService = licenseService;
    }

    public async Task<object> CreateAsync(CreateDeviceDto dto)
    {
        var exists = await _db.Devices.AnyAsync(d => d.DeviceId == dto.DeviceId);
        if (!exists)
        {
            // License validation for new devices
            var freeLicense = await _db.Licenses
                .FirstOrDefaultAsync(l => l.Tier == "free" && l.IsActive);

            if (freeLicense != null)
            {
                var canAdd = await _licenseService.CanAddDeviceAsync(freeLicense.Id);
                if (!canAdd)
                {
                    var validation = await _licenseService.ValidateLicenseAsync(freeLicense.Id);
                    if (validation.IsInGracePeriod)
                    {
                        throw new InvalidOperationException(
                            $"Device limit exceeded. Grace period ends: {validation.GracePeriodEndsAt:yyyy-MM-dd HH:mm:ss UTC}. Please upgrade your license.");
                    }
                    else
                    {
                        throw new InvalidOperationException(
                            "Device limit reached. Cannot add more devices. Please upgrade your license.");
                    }
                }
            }

            var entity = new Device { DeviceId = dto.DeviceId, Name = dto.Name, CreatedAt = DateTime.UtcNow };

            // Assign free license if available
            if (freeLicense != null)
            {
                entity.LicenseId = freeLicense.Id;
                entity.LicenseActivatedAt = DateTime.UtcNow;
                freeLicense.CurrentDeviceCount++;
            }

            _db.Devices.Add(entity);
            await _db.SaveChangesAsync();
            // Generate and persist a token for the device
            entity.Token = GenerateToken();
            await _db.SaveChangesAsync();

            // Log device creation
            await _logService.AddLogAsync("Info",
                $"New device registered: '{entity.Name}' (DeviceId: {entity.DeviceId}, ID: {entity.Id})",
                entity.DeviceId,
                "DeviceService");

            return new { id = entity.Id, entity.DeviceId, entity.Name, token = entity.Token };
        }
        var d = await _db.Devices.FirstAsync(x => x.DeviceId == dto.DeviceId);
        // If no token yet, generate and persist; otherwise return existing
        if (string.IsNullOrEmpty(d.Token))
        {
            d.Token = GenerateToken();
            await _db.SaveChangesAsync();

            // Log token generation for existing device
            await _logService.AddLogAsync("Info",
                $"Token generated for existing device: '{d.Name}' (DeviceId: {d.DeviceId})",
                d.DeviceId,
                "DeviceService");
        }
        return new { id = d.Id, d.DeviceId, d.Name, token = d.Token };
    }

    public async Task<IEnumerable<object>> FindAllAsync()
    {
        return await _db.Devices.OrderBy(d => d.Id)
            .Select(d => new { id = d.Id, deviceId = d.DeviceId, name = d.Name, createdAt = d.CreatedAt, displayWidth = d.DisplayWidth, displayHeight = d.DisplayHeight, kioskMode = d.KioskMode })
            .ToListAsync();
    }

    public async Task<object?> FindOneAsync(int id)
    {
        var d = await _db.Devices.FindAsync(id);
        return d == null ? null : new { id = d.Id, deviceId = d.DeviceId, name = d.Name, createdAt = d.CreatedAt, displayWidth = d.DisplayWidth, displayHeight = d.DisplayHeight, kioskMode = d.KioskMode };
    }

    public async Task<IEnumerable<DeviceLogDto>> GetLogsAsync(int id, int limit)
    {
        return await _db.DeviceLogs.Where(l => l.DeviceId == id)
            .OrderByDescending(l => l.Timestamp)
            .Take(limit)
            .Select(l => new DeviceLogDto(l.Id, l.Message, l.Timestamp))
            .ToListAsync();
    }

    public async Task<object> GetTokenAsync(int id)
    {
        var d = await _db.Devices.FindAsync(id);
        if (d == null) return new { error = "not_found" };
        if (string.IsNullOrEmpty(d.Token))
        {
            d.Token = GenerateToken();
            await _db.SaveChangesAsync();
        }
        return new { id = d.Id, deviceId = d.DeviceId, name = d.Name, token = d.Token };
    }

    public async Task<object> RotateTokenAsync(int id)
    {
        var d = await _db.Devices.FindAsync(id);
        if (d == null) return new { error = "not_found" };
        d.Token = GenerateToken();
        await _db.SaveChangesAsync();

        // Log token rotation
        await _logService.AddLogAsync("Info",
            $"Token rotated for device: '{d.Name}' (DeviceId: {d.DeviceId}, ID: {d.Id})",
            d.DeviceId,
            "DeviceService");

        return new { id = d.Id, deviceId = d.DeviceId, name = d.Name, token = d.Token };
    }

    private static string GenerateToken()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray())
            .TrimEnd('=')
            .Replace("+", "-")
            .Replace("/", "_");
    }

    public async Task<object> UpdateAsync(int id, UpdateDeviceDto dto)
    {
        var d = await _db.Devices.FindAsync(id);
        if (d == null) return new { error = "not_found" };

        var changes = new List<string>();
        if (!string.IsNullOrWhiteSpace(dto.Name) && d.Name != dto.Name)
        {
            changes.Add($"Name: '{d.Name}' → '{dto.Name}'");
            d.Name = dto.Name!;
        }
        if (dto.DisplayWidth.HasValue && d.DisplayWidth != dto.DisplayWidth)
        {
            changes.Add($"DisplayWidth: {d.DisplayWidth} → {dto.DisplayWidth}");
            d.DisplayWidth = dto.DisplayWidth;
        }
        if (dto.DisplayHeight.HasValue && d.DisplayHeight != dto.DisplayHeight)
        {
            changes.Add($"DisplayHeight: {d.DisplayHeight} → {dto.DisplayHeight}");
            d.DisplayHeight = dto.DisplayHeight;
        }
        if (dto.KioskMode.HasValue && d.KioskMode != dto.KioskMode)
        {
            changes.Add($"KioskMode: {d.KioskMode} → {dto.KioskMode}");
            d.KioskMode = dto.KioskMode;
        }

        await _db.SaveChangesAsync();

        // Log device update if changes were made
        if (changes.Any())
        {
            await _logService.AddLogAsync("Info",
                $"Device '{d.Name}' (ID: {d.Id}) updated: {string.Join(", ", changes)}",
                d.DeviceId,
                "DeviceService");
        }

        // Send config update to device via WebSocket
        await RealtimeHub.SendToDevice(d.DeviceId, "config:update", new
        {
            displayWidth = d.DisplayWidth,
            displayHeight = d.DisplayHeight,
            kioskMode = d.KioskMode
        });

        return new { id = d.Id, deviceId = d.DeviceId, name = d.Name, displayWidth = d.DisplayWidth, displayHeight = d.DisplayHeight, kioskMode = d.KioskMode };
    }

    public async Task RemoveAsync(int id)
    {
        var d = await _db.Devices.FindAsync(id);
        if (d == null) return;

        // Log device deletion
        await _logService.AddLogAsync("Warning",
            $"Device deleted: '{d.Name}' (DeviceId: {d.DeviceId}, ID: {d.Id})",
            d.DeviceId,
            "DeviceService");

        _db.Devices.Remove(d);
        await _db.SaveChangesAsync();
    }
}
