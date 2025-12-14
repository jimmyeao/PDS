using Microsoft.EntityFrameworkCore;

namespace PDS.Api;

public partial class PdsDbContext : DbContext
{
    public PdsDbContext(DbContextOptions<PdsDbContext> options) : base(options) {}
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceLog> DeviceLogs => Set<DeviceLog>();
    public DbSet<ContentItem> Content => Set<ContentItem>();
    public DbSet<Playlist> Playlists => Set<Playlist>();
    public DbSet<PlaylistItem> PlaylistItems => Set<PlaylistItem>();
    public DbSet<DevicePlaylist> DevicePlaylists => Set<DevicePlaylist>();
    public DbSet<Screenshot> Screenshots => Set<Screenshot>();
    public DbSet<DeviceBroadcastState> DeviceBroadcastStates => Set<DeviceBroadcastState>();
    public DbSet<User> Users => Set<User>();
}

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
}

public class Device
{
    public int Id { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Token { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Display Configuration (nullable - will use client .env defaults if not set)
    public int? DisplayWidth { get; set; }
    public int? DisplayHeight { get; set; }
    public bool? KioskMode { get; set; }
}

public class DeviceLog
{
    public int Id { get; set; }
    public int DeviceId { get; set; }
    public Device? Device { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class ContentItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Url { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Auto-authentication fields
    public string? UsernameSelector { get; set; }  // CSS selector for username field
    public string? PasswordSelector { get; set; }  // CSS selector for password field
    public string? SubmitSelector { get; set; }    // CSS selector for submit button
    public string? Username { get; set; }          // Username to fill
    public string? Password { get; set; }          // Password to fill (encrypted in production!)
    public bool AutoLogin { get; set; } = false;   // Enable auto-login for this content
}

public class Playlist
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public ICollection<PlaylistItem> Items { get; set; } = new List<PlaylistItem>();
}

public class PlaylistItem
{
    public int Id { get; set; }
    public int PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }
    public int? ContentId { get; set; }
    public string Url { get; set; } = string.Empty;
    public int? DurationSeconds { get; set; }
    public int? OrderIndex { get; set; }
    public string? TimeWindowStart { get; set; }
    public string? TimeWindowEnd { get; set; }
    public string? DaysOfWeek { get; set; }
}

public class DevicePlaylist
{
    public int Id { get; set; }
    public int DeviceId { get; set; }
    public Device? Device { get; set; }
    public int PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }
}

public class Screenshot
{
    public int Id { get; set; }
    public string DeviceStringId { get; set; } = string.Empty;
    public string ImageBase64 { get; set; } = string.Empty;
    public string? CurrentUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class DeviceBroadcastState
{
    public int Id { get; set; }
    public int DeviceId { get; set; }
    public Device? Device { get; set; }
    public int? OriginalPlaylistId { get; set; }
    public Playlist? OriginalPlaylist { get; set; }
    public string BroadcastUrl { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
}
