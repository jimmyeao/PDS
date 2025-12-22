using Microsoft.EntityFrameworkCore;
using TheiaCast.Api.Contracts;

namespace TheiaCast.Api;

public interface IBroadcastService
{
    Task<object> StartBroadcastAsync(string type, string? url, string? message, int? duration);
    Task EndBroadcastAsync();
    Task<object?> GetActiveBroadcastAsync();
}

public class BroadcastService : IBroadcastService
{
    private readonly PdsDbContext _db;
    private readonly ILogger<BroadcastService> _logger;

    public BroadcastService(PdsDbContext db, ILogger<BroadcastService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<object> StartBroadcastAsync(string type, string? url, string? message, int? duration)
    {
        // End any active broadcast first
        await EndBroadcastAsync();

        // Create new broadcast
        var broadcast = new Broadcast
        {
            Type = type,
            Url = url,
            Message = message,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Broadcasts.Add(broadcast);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Broadcast started: {Type} - {Url}{Message} Duration: {Duration}ms", type, url, message, duration);

        // Send broadcast to all connected devices
        var payload = new BroadcastPayload(type, url, message, duration);
        await RealtimeHub.BroadcastToDevicesAsync(ServerToClientEvent.BROADCAST_START, payload);

        // Save broadcast state for each device
        var devices = await _db.Devices.ToListAsync();
        foreach (var device in devices)
        {
            // Get current playlist for this device
            var devicePlaylist = await _db.DevicePlaylists
                .Where(dp => dp.DeviceId == device.Id)
                .OrderByDescending(dp => dp.Id)
                .FirstOrDefaultAsync();

            // Remove existing broadcast state if any
            var existingState = await _db.DeviceBroadcastStates
                .FirstOrDefaultAsync(dbs => dbs.DeviceId == device.Id);
            if (existingState != null)
            {
                _db.DeviceBroadcastStates.Remove(existingState);
            }

            // Create new broadcast state
            var broadcastState = new DeviceBroadcastState
            {
                DeviceId = device.Id,
                OriginalPlaylistId = devicePlaylist?.PlaylistId,
                BroadcastUrl = url ?? "",
                StartedAt = DateTime.UtcNow
            };
            _db.DeviceBroadcastStates.Add(broadcastState);
        }

        await _db.SaveChangesAsync();

        return new { id = broadcast.Id, type = broadcast.Type, url = broadcast.Url, message = broadcast.Message };
    }

    public async Task EndBroadcastAsync()
    {
        // Find active broadcast
        var activeBroadcast = await _db.Broadcasts
            .Where(b => b.IsActive)
            .FirstOrDefaultAsync();

        if (activeBroadcast != null)
        {
            activeBroadcast.IsActive = false;
            activeBroadcast.EndedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation("Broadcast ended: {Id}", activeBroadcast.Id);

            // Notify all devices to end broadcast
            await RealtimeHub.BroadcastToDevicesAsync(ServerToClientEvent.BROADCAST_END, new { });

            // Clear broadcast states
            var broadcastStates = await _db.DeviceBroadcastStates.ToListAsync();
            _db.DeviceBroadcastStates.RemoveRange(broadcastStates);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<object?> GetActiveBroadcastAsync()
    {
        var broadcast = await _db.Broadcasts
            .Where(b => b.IsActive)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        if (broadcast == null) return null;

        return new
        {
            id = broadcast.Id,
            type = broadcast.Type,
            url = broadcast.Url,
            message = broadcast.Message,
            createdAt = broadcast.CreatedAt
        };
    }
}
