using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PDS.Api;
using PDS.Api.Contracts;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Bind to all interfaces on port 5001 by default
// builder.WebHost.UseUrls("http://0.0.0.0:5001");

builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console());

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(o =>
  {
      var secret = builder.Configuration["Jwt:Secret"] ?? "dev-secret-key";
      o.TokenValidationParameters = new TokenValidationParameters
      {
          ValidateIssuer = true,
          ValidateAudience = true,
          ValidateLifetime = true,
          ValidateIssuerSigningKey = true,
          ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "pds",
          ValidAudience = builder.Configuration["Jwt:Audience"] ?? "pds-clients",
          IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret))
      };
  });

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

// CORS for frontend dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
    
    // Broad dev policy: allow any origin for rapid iteration
    options.AddPolicy("DevAll", policy =>
    {
          policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddDbContext<PdsDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default") ??
        "Host=localhost;Port=5432;Database=pds;Username=postgres;Password=postgres"));

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddScoped<IPlaylistService, PlaylistService>();
builder.Services.AddScoped<IScreenshotService, ScreenshotService>();

var app = builder.Build();
var cfg = builder.Configuration;

app.UseSerilogRequestLogging();
app.UseSwagger();
app.UseSwaggerUI();
// Apply CORS before auth/authorization so preflights and failures still include CORS headers
 // Prefer permissive CORS in dev; fallback to Frontend policy
 app.UseCors("DevAll");
app.UseAuthentication();
app.UseAuthorization();

// Ensure Devices.Token column exists for persistent tokens
using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<PdsDbContext>();
        
        // Ensure the database and tables exist
        db.Database.EnsureCreated();

        db.Database.ExecuteSqlRaw("ALTER TABLE \"Devices\" ADD COLUMN IF NOT EXISTS \"Token\" text;");
        db.Database.ExecuteSqlRaw("CREATE UNIQUE INDEX IF NOT EXISTS \"IX_Devices_DeviceId_unique\" ON \"Devices\"(\"DeviceId\");");
        // Ensure new PlaylistItem columns exist
        db.Database.ExecuteSqlRaw("ALTER TABLE \"PlaylistItems\" ADD COLUMN IF NOT EXISTS \"ContentId\" int;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"PlaylistItems\" ADD COLUMN IF NOT EXISTS \"OrderIndex\" int;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"PlaylistItems\" ADD COLUMN IF NOT EXISTS \"TimeWindowStart\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"PlaylistItems\" ADD COLUMN IF NOT EXISTS \"TimeWindowEnd\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"PlaylistItems\" ADD COLUMN IF NOT EXISTS \"DaysOfWeek\" text;");

        // Backfill missing ContentId by matching URL to Content table
        db.Database.ExecuteSqlRaw("UPDATE \"PlaylistItems\" pi\n" +
            "    SET \"ContentId\" = c.\"Id\"\n" +
            "    FROM \"Content\" c\n" +
            "    WHERE pi.\"ContentId\" IS NULL AND pi.\"Url\" IS NOT NULL AND c.\"Url\" = pi.\"Url\";");

        // Backfill missing OrderIndex with row_number per playlist
                db.Database.ExecuteSqlRaw("WITH ranked AS (\n" +
                        "      SELECT \"Id\", \"PlaylistId\",\n" +
                        "             ROW_NUMBER() OVER (PARTITION BY \"PlaylistId\" ORDER BY \"Id\") - 1 AS rn\n" +
                        "      FROM \"PlaylistItems\"\n" +
                        "      WHERE \"OrderIndex\" IS NULL\n" +
                        ")\n" +
                        "UPDATE \"PlaylistItems\" pi\n" +
                        "SET \"OrderIndex\" = r.rn\n" +
                        "FROM ranked r\n" +
                        "WHERE pi.\"Id\" = r.\"Id\" AND pi.\"PlaylistId\" = r.\"PlaylistId\";");

        // Add auto-authentication columns to Content table
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Content\" ADD COLUMN IF NOT EXISTS \"UsernameSelector\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Content\" ADD COLUMN IF NOT EXISTS \"PasswordSelector\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Content\" ADD COLUMN IF NOT EXISTS \"SubmitSelector\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Content\" ADD COLUMN IF NOT EXISTS \"Username\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Content\" ADD COLUMN IF NOT EXISTS \"Password\" text;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Content\" ADD COLUMN IF NOT EXISTS \"AutoLogin\" boolean DEFAULT false;");

        // Add display configuration columns to Devices table
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Devices\" ADD COLUMN IF NOT EXISTS \"DisplayWidth\" int;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Devices\" ADD COLUMN IF NOT EXISTS \"DisplayHeight\" int;");
        db.Database.ExecuteSqlRaw("ALTER TABLE \"Devices\" ADD COLUMN IF NOT EXISTS \"KioskMode\" boolean;");

        // Create DeviceBroadcastStates table for broadcast tracking
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""DeviceBroadcastStates"" (
                ""Id"" SERIAL PRIMARY KEY,
                ""DeviceId"" int NOT NULL,
                ""OriginalPlaylistId"" int,
                ""BroadcastUrl"" text NOT NULL,
                ""StartedAt"" timestamp NOT NULL
            );
        ");
    }
    catch (Exception ex)
    {
        Serilog.Log.Warning(ex, "Startup schema ensure failed");
    }
}

app.MapHealthChecks("/health");
app.MapHealthChecks("/healthz");

// Auth endpoints (inline token generation to avoid DI issues)
app.MapPost("/auth/register", ([FromBody] RegisterDto dto, ILogger<Program> log) =>
{
    try
    {
        var res = AuthHelpers.GenerateTokens(dto.Username, cfg);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Register failed");
        return Results.Problem(title: "Register failed", detail: ex.Message, statusCode: 500);
    }
}).AllowAnonymous();

app.MapPost("/auth/login", ([FromBody] LoginDto dto, ILogger<Program> log) =>
{
    try
    {
        var res = AuthHelpers.GenerateTokens(dto.Username, cfg);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Login failed");
        return Results.Problem(title: "Login failed", detail: ex.Message, statusCode: 500);
    }
}).AllowAnonymous();

app.MapPost("/auth/refresh", ([FromBody] RefreshDto dto, ILogger<Program> log) =>
{
    try
    {
        var res = AuthHelpers.GenerateTokens("user", cfg);
        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        log.LogError(ex, "Refresh failed");
        return Results.Problem(title: "Refresh failed", detail: ex.Message, statusCode: 500);
    }
}).AllowAnonymous();
app.MapGet("/auth/me", (ClaimsPrincipal user) => new UserDto(1, user.Identity?.Name ?? "user"))
    .RequireAuthorization();

// Devices endpoints
app.MapPost("/devices", async ([FromBody] CreateDeviceDto dto, IDeviceService svc) => await svc.CreateAsync(dto))
    .RequireAuthorization();
app.MapGet("/devices", async (IDeviceService svc) => await svc.FindAllAsync())
    .RequireAuthorization();
app.MapGet("/devices/{id:int}", async (int id, IDeviceService svc) => await svc.FindOneAsync(id))
    .RequireAuthorization();
app.MapGet("/devices/{id:int}/token", async (int id, IDeviceService svc) => await svc.GetTokenAsync(id))
    .RequireAuthorization();
app.MapPost("/devices/{id:int}/token/rotate", async (int id, IDeviceService svc) => await svc.RotateTokenAsync(id))
    .RequireAuthorization();
app.MapGet("/devices/{id:int}/logs", async (int id, int? limit, IDeviceService svc) => await svc.GetLogsAsync(id, limit ?? 100))
    .RequireAuthorization();
app.MapPatch("/devices/{id:int}", async (int id, [FromBody] UpdateDeviceDto dto, IDeviceService svc) => await svc.UpdateAsync(id, dto))
    .RequireAuthorization();
app.MapDelete("/devices/{id:int}", async (int id, IDeviceService svc) =>
{
    await svc.RemoveAsync(id);
    return Results.Ok(new { message = "Device deleted successfully" });
}).RequireAuthorization();

// Remote control endpoints
app.MapPost("/devices/{deviceId}/remote/click", async (string deviceId, [FromBody] RemoteClickRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:click", new { x = req.X, y = req.Y, button = req.Button ?? "left" });
    return Results.Ok(new { message = "Click command sent", deviceId, x = req.X, y = req.Y });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/remote/type", async (string deviceId, [FromBody] RemoteTypeRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:type", new { text = req.Text, selector = req.Selector });
    return Results.Ok(new { message = "Type command sent", deviceId, textLength = req.Text.Length });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/remote/key", async (string deviceId, [FromBody] RemoteKeyRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:key", new { key = req.Key, modifiers = req.Modifiers });
    return Results.Ok(new { message = "Key command sent", deviceId, key = req.Key });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/remote/scroll", async (string deviceId, [FromBody] RemoteScrollRequest req) =>
{
    await RealtimeHub.SendToDevice(deviceId, "remote:scroll", new { x = req.X, y = req.Y, deltaX = req.DeltaX, deltaY = req.DeltaY });
    return Results.Ok(new { message = "Scroll command sent", deviceId });
}).RequireAuthorization();

// Screencast control endpoints
app.MapPost("/devices/{deviceId}/screencast/start", async (string deviceId) =>
{
    await RealtimeHub.SendToDevice(deviceId, "screencast:start", new { });
    return Results.Ok(new { message = "Screencast start command sent", deviceId });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/screencast/stop", async (string deviceId) =>
{
    await RealtimeHub.SendToDevice(deviceId, "screencast:stop", new { });
    return Results.Ok(new { message = "Screencast stop command sent", deviceId });
}).RequireAuthorization();

// Playlist control endpoints
app.MapPost("/devices/{deviceId}/playlist/pause", async (string deviceId) =>
{
    await RealtimeHub.SendToDevice(deviceId, "playlist:pause", new { });
    return Results.Ok(new { message = "Playlist pause command sent", deviceId });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/playlist/resume", async (string deviceId) =>
{
    await RealtimeHub.SendToDevice(deviceId, "playlist:resume", new { });
    return Results.Ok(new { message = "Playlist resume command sent", deviceId });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/playlist/next", async (string deviceId, bool? respectConstraints) =>
{
    await RealtimeHub.SendToDevice(deviceId, "playlist:next", new { respectConstraints = respectConstraints ?? true });
    return Results.Ok(new { message = "Playlist next command sent", deviceId });
}).RequireAuthorization();

app.MapPost("/devices/{deviceId}/playlist/previous", async (string deviceId, bool? respectConstraints) =>
{
    await RealtimeHub.SendToDevice(deviceId, "playlist:previous", new { respectConstraints = respectConstraints ?? true });
    return Results.Ok(new { message = "Playlist previous command sent", deviceId });
}).RequireAuthorization();

// Broadcast endpoints
app.MapPost("/broadcast/start", async ([FromBody] BroadcastStartRequest req, PdsDbContext db) =>
{
    var duration = req.Duration ?? 0;

    // Save broadcast state for each device
    foreach (var deviceId in req.DeviceIds)
    {
        var device = await db.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
        if (device == null) continue;

        // Get current playlist assignment (if any)
        var currentPlaylist = await db.DevicePlaylists
            .Where(dp => dp.DeviceId == device.Id)
            .OrderByDescending(dp => dp.Id)
            .Select(dp => dp.PlaylistId)
            .FirstOrDefaultAsync();

        // Save broadcast state
        var broadcastState = new DeviceBroadcastState
        {
            DeviceId = device.Id,
            OriginalPlaylistId = currentPlaylist > 0 ? currentPlaylist : null,
            BroadcastUrl = req.Url,
            StartedAt = DateTime.UtcNow
        };
        db.DeviceBroadcastStates.Add(broadcastState);

        // Send broadcast start command to device
        await RealtimeHub.SendToDevice(deviceId, "playlist:broadcast:start", new { url = req.Url, duration });
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Broadcast started", deviceCount = req.DeviceIds.Length, url = req.Url, duration });
}).RequireAuthorization();

app.MapPost("/broadcast/end", async (PdsDbContext db) =>
{
    // Get all active broadcasts
    var activeStates = await db.DeviceBroadcastStates.Include(bs => bs.Device).ToListAsync();

    if (!activeStates.Any())
    {
        return Results.Ok(new { message = "No active broadcasts", deviceCount = 0 });
    }

    // Send end command to all broadcasting devices
    foreach (var state in activeStates)
    {
        if (state.Device?.DeviceId != null)
        {
            await RealtimeHub.SendToDevice(state.Device.DeviceId, "playlist:broadcast:end", new { });
        }
    }

    // Remove broadcast states
    db.DeviceBroadcastStates.RemoveRange(activeStates);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Broadcast ended", deviceCount = activeStates.Count });
}).RequireAuthorization();

app.MapGet("/broadcast/status", async (PdsDbContext db) =>
{
    var activeStates = await db.DeviceBroadcastStates
        .Include(bs => bs.Device)
        .Select(bs => new
        {
            deviceId = bs.Device!.DeviceId,
            deviceName = bs.Device.Name,
            broadcastUrl = bs.BroadcastUrl,
            startedAt = bs.StartedAt
        })
        .ToListAsync();

    return Results.Ok(new { broadcasts = activeStates, count = activeStates.Count });
}).RequireAuthorization();

// Content endpoints
app.MapPost("/content", async ([FromBody] CreateContentDto dto, IPlaylistService svc) => await svc.CreateContentAsync(dto))
    .RequireAuthorization();
app.MapGet("/content", async (IPlaylistService svc) => await svc.GetAllContentAsync())
    .RequireAuthorization();
app.MapGet("/content/{id:int}", async (int id, IPlaylistService svc) => await svc.GetContentAsync(id))
    .RequireAuthorization();
app.MapPatch("/content/{id:int}", async (int id, [FromBody] UpdateContentDto dto, IPlaylistService svc) => await svc.UpdateContentAsync(id, dto))
    .RequireAuthorization();
app.MapDelete("/content/{id:int}", async (int id, IPlaylistService svc) =>
{
    await svc.RemoveContentAsync(id);
    return Results.Ok(new { message = "Content deleted successfully" });
}).RequireAuthorization();

// Playlists endpoints
app.MapPost("/playlists", async ([FromBody] CreatePlaylistDto dto, IPlaylistService svc) => await svc.CreatePlaylistAsync(dto))
    .RequireAuthorization();
app.MapGet("/playlists", async (IPlaylistService svc) => await svc.GetPlaylistsAsync())
    .AllowAnonymous();
app.MapGet("/playlists/{id:int}", async (int id, IPlaylistService svc) => await svc.GetPlaylistAsync(id))
    .AllowAnonymous();
app.MapPatch("/playlists/{id:int}", async (int id, [FromBody] UpdatePlaylistDto dto, IPlaylistService svc) => await svc.UpdatePlaylistAsync(id, dto))
    .RequireAuthorization();
app.MapDelete("/playlists/{id:int}", async (int id, IPlaylistService svc) =>
{
    await svc.RemovePlaylistAsync(id);
    return Results.Ok(new { message = "Playlist deleted successfully" });
}).RequireAuthorization();

app.MapPost("/playlists/items", async ([FromBody] CreatePlaylistItemDto dto, IPlaylistService svc) => await svc.CreateItemAsync(dto))
    .RequireAuthorization();
app.MapGet("/playlists/{playlistId:int}/items", async (int playlistId, IPlaylistService svc) => await svc.GetItemsAsync(playlistId))
    .AllowAnonymous();
app.MapPatch("/playlists/items/{id:int}", async (int id, [FromBody] UpdatePlaylistItemDto dto, IPlaylistService svc) => await svc.UpdateItemAsync(id, dto))
    .RequireAuthorization();
app.MapDelete("/playlists/items/{id:int}", async (int id, IPlaylistService svc) =>
{
    var playlistId = await svc.RemoveItemAsync(id);
    return Results.Ok(new { message = "Playlist item deleted successfully" });
}).RequireAuthorization();

app.MapPost("/playlists/assign", async ([FromBody] AssignPlaylistDto dto, IPlaylistService svc) => await svc.AssignAsync(dto))
    .RequireAuthorization();
app.MapGet("/playlists/device/{deviceId:int}", async (int deviceId, IPlaylistService svc) => await svc.GetDevicePlaylistsAsync(deviceId))
    .RequireAuthorization();
app.MapGet("/playlists/{playlistId:int}/devices", async (int playlistId, IPlaylistService svc) => await svc.GetPlaylistDevicesAsync(playlistId))
    .RequireAuthorization();
app.MapDelete("/playlists/assign/device/{deviceId:int}/playlist/{playlistId:int}", async (int deviceId, int playlistId, IPlaylistService svc) =>
{
    await svc.UnassignAsync(deviceId, playlistId);
    return Results.Ok(new { message = "Playlist unassigned successfully" });
}).RequireAuthorization();

// Screenshots endpoints
app.MapGet("/screenshots/device/{deviceId}/latest", async (string deviceId, IScreenshotService svc) => await svc.GetLatestAsync(deviceId))
    .RequireAuthorization();
app.MapGet("/screenshots/device/{deviceId}", async (string deviceId, IScreenshotService svc) => await svc.GetByDeviceAsync(deviceId))
    .RequireAuthorization();
app.MapGet("/screenshots/{id}", async (int id, IScreenshotService svc) => await svc.GetByIdAsync(id))
    .RequireAuthorization();

// WebSocket endpoint with event envelope
app.UseWebSockets();
app.Map("/ws", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    var token = context.Request.Query["token"].ToString();
    var deviceId = context.Request.Query["deviceId"].ToString();

    // Resolve deviceId from token if provided
    if (!string.IsNullOrEmpty(token) && string.IsNullOrEmpty(deviceId))
    {
        try
        {
            using var scope = context.RequestServices.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PdsDbContext>();
            var device = await db.Devices.FirstOrDefaultAsync(d => d.Token == token);
            if (device != null)
            {
                deviceId = device.DeviceId;
            }
            else
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("unauthorized");
                return;
            }
        }
        catch
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsync("error");
            return;
        }
    }

    // Attach resolved deviceId for downstream handling
    if (!string.IsNullOrEmpty(deviceId))
    {
        context.Items["__resolvedDeviceId"] = deviceId;
    }

    var socket = await context.WebSockets.AcceptWebSocketAsync();
    await RealtimeHub.HandleAsync(context, socket);
});

app.Run();

// --- Minimal stub types & services ---
public record AuthResponse(string AccessToken, string RefreshToken);
public record RegisterDto(string Username, string Password);
public record LoginDto(string Username, string Password);
public record RefreshDto(string RefreshToken);
public record UserDto(int Id, string Username);

public record CreateDeviceDto(string DeviceId, string Name, string? Description, string? Location);
public record UpdateDeviceDto(string? Name, string? Description, string? Location, int? DisplayWidth, int? DisplayHeight, bool? KioskMode);
public record DeviceLogDto(int Id, string Message, DateTime Timestamp);

public record CreateContentDto(
    string Name,
    string Url,
    string? Description,
    bool? RequiresInteraction,
    string? ThumbnailUrl,
    string? UsernameSelector,
    string? PasswordSelector,
    string? SubmitSelector,
    string? Username,
    string? Password,
    bool? AutoLogin
);
public record UpdateContentDto(
    string? Name,
    string? Url,
    string? Description,
    bool? RequiresInteraction,
    string? ThumbnailUrl,
    string? UsernameSelector,
    string? PasswordSelector,
    string? SubmitSelector,
    string? Username,
    string? Password,
    bool? AutoLogin
);

public record CreatePlaylistDto(string Name, string? Description, bool? IsActive);
public record UpdatePlaylistDto(string? Name, string? Description, bool? IsActive);
public record CreatePlaylistItemDto(int PlaylistId, int ContentId, int DisplayDuration, int OrderIndex, string? TimeWindowStart, string? TimeWindowEnd, int[]? DaysOfWeek);
public record UpdatePlaylistItemDto(int? DisplayDuration, int? OrderIndex, string? TimeWindowStart, string? TimeWindowEnd, int[]? DaysOfWeek);
public record AssignPlaylistDto(int DeviceId, int PlaylistId);

public record RemoteClickRequest(int X, int Y, string? Button);
public record RemoteTypeRequest(string Text, string? Selector);
public record RemoteKeyRequest(string Key, string[]? Modifiers);
public record RemoteScrollRequest(int? X, int? Y, int? DeltaX, int? DeltaY);

public record BroadcastStartRequest(string[] DeviceIds, string Url, int? Duration);

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterDto dto);
    Task<AuthResponse> LoginAsync(LoginDto dto);
    Task<AuthResponse> RefreshAsync(RefreshDto dto);
    UserDto Me(ClaimsPrincipal user);
}

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

public interface IPlaylistService
{
    Task<object> CreatePlaylistAsync(CreatePlaylistDto dto);
    Task<IEnumerable<object>> GetPlaylistsAsync();
    Task<object?> GetPlaylistAsync(int id);
    Task<object> UpdatePlaylistAsync(int id, UpdatePlaylistDto dto);
    Task RemovePlaylistAsync(int id);

    Task<object> CreateItemAsync(CreatePlaylistItemDto dto);
    Task<IEnumerable<object>> GetItemsAsync(int playlistId);
    Task<object> UpdateItemAsync(int id, UpdatePlaylistItemDto dto);
    Task<int> RemoveItemAsync(int id);

    Task<object> AssignAsync(AssignPlaylistDto dto);
    Task<IEnumerable<object>> GetDevicePlaylistsAsync(int deviceId);
    Task<IEnumerable<object>> GetPlaylistDevicesAsync(int playlistId);
    Task UnassignAsync(int deviceId, int playlistId);

    // Content
    Task<object> CreateContentAsync(CreateContentDto dto);
    Task<IEnumerable<object>> GetAllContentAsync();
    Task<object?> GetContentAsync(int id);
    Task<object> UpdateContentAsync(int id, UpdateContentDto dto);
    Task RemoveContentAsync(int id);
}

public interface IScreenshotService
{
    Task<object?> GetLatestAsync(string deviceId);
    Task<IEnumerable<object>> GetByDeviceAsync(string deviceId);
    Task<object?> GetByIdAsync(int id);
}

public class AuthService : IAuthService
{
    private readonly IConfiguration _config;
    public AuthService(IConfiguration config) => _config = config;

    public Task<AuthResponse> RegisterAsync(RegisterDto dto)
        => Task.FromResult(GenerateTokens(dto.Username));

    public Task<AuthResponse> LoginAsync(LoginDto dto)
        => Task.FromResult(GenerateTokens(dto.Username));

    public Task<AuthResponse> RefreshAsync(RefreshDto dto)
        => Task.FromResult(GenerateTokens("user"));

    public UserDto Me(ClaimsPrincipal user)
        => new UserDto(1, user.Identity?.Name ?? "user");

    private AuthResponse GenerateTokens(string username)
    {
        var issuer = _config["Jwt:Issuer"] ?? "pds";
        var audience = _config["Jwt:Audience"] ?? "pds-clients";
        var secret = _config["Jwt:Secret"] ?? "dev-secret-key";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(ClaimTypes.Name, username)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Guid.NewGuid().ToString("n");
        return new AuthResponse(accessToken, refreshToken);
    }
}

public static class AuthHelpers
{
    public static AuthResponse GenerateTokens(string username, IConfiguration config)
    {
        var issuer = config["Jwt:Issuer"] ?? "pds";
        var audience = config["Jwt:Audience"] ?? "pds-clients";
        var secret = config["Jwt:Secret"] ?? "dev-secret-key";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(ClaimTypes.Name, username)
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Guid.NewGuid().ToString("n");
        return new AuthResponse(accessToken, refreshToken);
    }
}

public class DeviceService : IDeviceService
{
    private readonly PdsDbContext _db;
    public DeviceService(PdsDbContext db) => _db = db;

    public async Task<object> CreateAsync(CreateDeviceDto dto)
    {
        var exists = await _db.Devices.AnyAsync(d => d.DeviceId == dto.DeviceId);
        if (!exists)
        {
            var entity = new Device { DeviceId = dto.DeviceId, Name = dto.Name, CreatedAt = DateTime.UtcNow };
            _db.Devices.Add(entity);
            await _db.SaveChangesAsync();
            // Generate and persist a token for the device
            entity.Token = GenerateToken();
            await _db.SaveChangesAsync();
            return new { id = entity.Id, entity.DeviceId, entity.Name, token = entity.Token };
        }
        var d = await _db.Devices.FirstAsync(x => x.DeviceId == dto.DeviceId);
        // If no token yet, generate and persist; otherwise return existing
        if (string.IsNullOrEmpty(d.Token))
        {
            d.Token = GenerateToken();
            await _db.SaveChangesAsync();
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
        if (!string.IsNullOrWhiteSpace(dto.Name)) d.Name = dto.Name!;
        if (dto.DisplayWidth.HasValue) d.DisplayWidth = dto.DisplayWidth;
        if (dto.DisplayHeight.HasValue) d.DisplayHeight = dto.DisplayHeight;
        if (dto.KioskMode.HasValue) d.KioskMode = dto.KioskMode;
        await _db.SaveChangesAsync();

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
        _db.Devices.Remove(d);
        await _db.SaveChangesAsync();
    }
}

public class PlaylistService : IPlaylistService
{
    private readonly PdsDbContext _db;
    public PlaylistService(PdsDbContext db) => _db = db;

    public async Task<object> CreatePlaylistAsync(CreatePlaylistDto dto)
    {
        var p = new Playlist { Name = dto.Name, IsActive = dto.IsActive ?? true };
        _db.Playlists.Add(p);
        await _db.SaveChangesAsync();
        return new { id = p.Id, p.Name, isActive = p.IsActive };
    }

    public async Task<IEnumerable<object>> GetPlaylistsAsync()
    {
        return await _db.Playlists.OrderBy(p => p.Id)
            .Select(p => new { id = p.Id, name = p.Name, isActive = p.IsActive })
            .ToListAsync();
    }

    public async Task<object?> GetPlaylistAsync(int id)
    {
        var p = await _db.Playlists.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        if (p == null) return null;
        var items = p.Items
            .OrderBy(i => i.Id)
            .Select(i => new
            {
                id = i.Id,
                playlistId = p.Id,
                contentId = i.Id, // placeholder until schema expanded
                displayDuration = (i.DurationSeconds ?? 0) * 1000,
                orderIndex = i.Id,
                timeWindowStart = (string?)null,
                timeWindowEnd = (string?)null,
                daysOfWeek = (string?)null,
                content = new { id = i.Id, name = i.Url, url = i.Url, requiresInteraction = false }
            });
        return new { id = p.Id, name = p.Name, isActive = p.IsActive, items };
    }

    public async Task<object> UpdatePlaylistAsync(int id, UpdatePlaylistDto dto)
    {
        var p = await _db.Playlists.FindAsync(id);
        if (p == null) return new { error = "not_found" };
        if (!string.IsNullOrWhiteSpace(dto.Name)) p.Name = dto.Name!;
        if (dto.IsActive != null) p.IsActive = dto.IsActive.Value;
        await _db.SaveChangesAsync();
        return new { id = p.Id, name = p.Name, isActive = p.IsActive };
    }

    public async Task RemovePlaylistAsync(int id)
    {
        var p = await _db.Playlists.FindAsync(id);
        if (p == null) return;
        _db.Playlists.Remove(p);
        await _db.SaveChangesAsync();
    }

    public async Task<object> CreateItemAsync(CreatePlaylistItemDto dto)
    {
        // Resolve content URL by ContentId, fall back to empty string
        var content = await _db.Content.FindAsync(dto.ContentId);
        var url = content?.Url ?? "";
        var i = new PlaylistItem
        {
            PlaylistId = dto.PlaylistId,
            ContentId = dto.ContentId,
            Url = url,
            DurationSeconds = (dto.DisplayDuration <= 0 ? 0 : dto.DisplayDuration / 1000),
            OrderIndex = dto.OrderIndex,
            TimeWindowStart = dto.TimeWindowStart,
            TimeWindowEnd = dto.TimeWindowEnd,
            DaysOfWeek = dto.DaysOfWeek != null ? System.Text.Json.JsonSerializer.Serialize(dto.DaysOfWeek) : null
        };
        _db.PlaylistItems.Add(i);
        await _db.SaveChangesAsync();

        // Broadcast updated playlist items to all assigned devices
        var pid = i.PlaylistId;
        var deviceIds = await _db.DevicePlaylists.Where(x => x.PlaylistId == pid)
            .Join(_db.Devices, dp => dp.DeviceId, d => d.Id, (dp, d) => d.DeviceId)
            .ToListAsync();
        var items = await _db.PlaylistItems.Where(x => x.PlaylistId == pid)
            .OrderBy(x => x.OrderIndex ?? x.Id)
            .Select(x => new {
                id = x.Id,
                playlistId = x.PlaylistId,
                contentId = x.ContentId,
                displayDuration = (x.DurationSeconds ?? 0) * 1000,
                orderIndex = x.OrderIndex ?? 0,
                content = new { id = x.ContentId, name = x.Url, url = x.Url, requiresInteraction = false }
            })
            .ToListAsync();
        foreach (var devId in deviceIds)
        {
            await RealtimeHub.SendToDevice(devId, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = pid, items });
        }

        return new { id = i.Id, playlistId = i.PlaylistId, contentId = i.ContentId, url = i.Url, durationSeconds = i.DurationSeconds, orderIndex = i.OrderIndex };
    }

    public async Task<IEnumerable<object>> GetItemsAsync(int playlistId)
    {
        return await _db.PlaylistItems.Where(i => i.PlaylistId == playlistId)
            .OrderBy(i => i.OrderIndex ?? i.Id)
            .Select(i => new
            {
                id = i.Id,
                playlistId = i.PlaylistId,
                contentId = i.ContentId,
                url = i.Url,
                durationSeconds = i.DurationSeconds,
                orderIndex = i.OrderIndex ?? 0,
                timeWindowStart = i.TimeWindowStart,
                timeWindowEnd = i.TimeWindowEnd,
                daysOfWeek = i.DaysOfWeek
            })
            .ToListAsync();
    }

    public async Task<object> UpdateItemAsync(int id, UpdatePlaylistItemDto dto)
    {
        var i = await _db.PlaylistItems.FindAsync(id);
        if (i == null) return new { error = "not_found" };
        if (dto.DisplayDuration != null) i.DurationSeconds = (dto.DisplayDuration.Value <= 0 ? 0 : dto.DisplayDuration.Value / 1000);
        if (dto.OrderIndex != null) i.OrderIndex = dto.OrderIndex.Value;
        if (dto.TimeWindowStart != null) i.TimeWindowStart = dto.TimeWindowStart;
        if (dto.TimeWindowEnd != null) i.TimeWindowEnd = dto.TimeWindowEnd;
        if (dto.DaysOfWeek != null) i.DaysOfWeek = System.Text.Json.JsonSerializer.Serialize(dto.DaysOfWeek);
        await _db.SaveChangesAsync();
        return new { id = i.Id, playlistId = i.PlaylistId, contentId = i.ContentId, url = i.Url, durationSeconds = i.DurationSeconds, orderIndex = i.OrderIndex };
    }

    public async Task<int> RemoveItemAsync(int id)
    {
        var i = await _db.PlaylistItems.FindAsync(id);
        if (i == null) return 0;
        var pid = i.PlaylistId;
        _db.PlaylistItems.Remove(i);
        await _db.SaveChangesAsync();

        // Notify all devices assigned to this playlist with updated items
        var deviceIds = await _db.DevicePlaylists.Where(x => x.PlaylistId == pid)
            .Join(_db.Devices, dp => dp.DeviceId, d => d.Id, (dp, d) => d.DeviceId)
            .ToListAsync();
        var items = await _db.PlaylistItems.Where(x => x.PlaylistId == pid)
            .OrderBy(x => x.OrderIndex ?? x.Id)
            .Select(x => new {
                id = x.Id,
                playlistId = x.PlaylistId,
                contentId = x.ContentId,
                displayDuration = (x.DurationSeconds ?? 0) * 1000,
                orderIndex = x.OrderIndex ?? 0,
                content = new { id = x.ContentId, name = x.Url, url = x.Url, requiresInteraction = false }
            })
            .ToListAsync();
        foreach (var devId in deviceIds)
        {
            await RealtimeHub.SendToDevice(devId, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = pid, items });
        }
        return pid;
    }

    public async Task<object> AssignAsync(AssignPlaylistDto dto)
    {
        // Avoid duplicate assignment
        var exists = await _db.DevicePlaylists.AnyAsync(x => x.DeviceId == dto.DeviceId && x.PlaylistId == dto.PlaylistId);
        if (!exists)
        {
            var dp = new DevicePlaylist { DeviceId = dto.DeviceId, PlaylistId = dto.PlaylistId };
            _db.DevicePlaylists.Add(dp);
            await _db.SaveChangesAsync();
        }

        // Push content update to device if connected
        var device = await _db.Devices.FindAsync(dto.DeviceId);
        if (device != null)
        {
            var items = await _db.PlaylistItems.Where(i => i.PlaylistId == dto.PlaylistId)
                .OrderBy(i => i.OrderIndex ?? i.Id)
                .Select(i => new {
                    id = i.Id,
                    playlistId = i.PlaylistId,
                    contentId = i.ContentId,
                    displayDuration = (i.DurationSeconds ?? 0) * 1000,
                    orderIndex = i.OrderIndex ?? 0,
                    content = new { id = i.ContentId, name = i.Url, url = i.Url, requiresInteraction = false }
                })
                .ToListAsync();
            await RealtimeHub.SendToDevice(device.DeviceId, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = dto.PlaylistId, items });
        }

        return new { deviceId = dto.DeviceId, playlistId = dto.PlaylistId };
    }

    public async Task<IEnumerable<object>> GetDevicePlaylistsAsync(int deviceId)
    {
        return await _db.DevicePlaylists.Where(x => x.DeviceId == deviceId)
            .Join(_db.Playlists, dp => dp.PlaylistId, p => p.Id, (dp, p) => new { id = p.Id, name = p.Name, isActive = p.IsActive })
            .Distinct()
            .ToListAsync();
    }

    public async Task<IEnumerable<object>> GetPlaylistDevicesAsync(int playlistId)
    {
        return await _db.DevicePlaylists.Where(x => x.PlaylistId == playlistId)
            .Join(_db.Devices, dp => dp.DeviceId, d => d.Id, (dp, d) => new { id = d.Id, deviceId = d.DeviceId, name = d.Name })
            .ToListAsync();
    }

    public async Task UnassignAsync(int deviceId, int playlistId)
    {
        var dp = await _db.DevicePlaylists.FirstOrDefaultAsync(x => x.DeviceId == deviceId && x.PlaylistId == playlistId);
        if (dp == null) return;
        _db.DevicePlaylists.Remove(dp);
        await _db.SaveChangesAsync();

        // If device has no more playlists, push empty content update
        var remaining = await _db.DevicePlaylists.AnyAsync(x => x.DeviceId == deviceId);
        var device = await _db.Devices.FindAsync(deviceId);
        if (device != null)
        {
            if (!remaining)
            {
                await RealtimeHub.SendToDevice(device.DeviceId, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = 0, items = Array.Empty<object>() });
            }
            else
            {
                // Optionally, pick one playlist and push its items
                var nextPid = await _db.DevicePlaylists.Where(x => x.DeviceId == deviceId).Select(x => x.PlaylistId).FirstAsync();
                var items = await _db.PlaylistItems.Where(x => x.PlaylistId == nextPid)
                    .OrderBy(x => x.Id)
                    .Select(x => new
                    {
                        id = x.Id,
                        playlistId = nextPid,
                        contentId = x.Id,
                        displayDuration = (x.DurationSeconds ?? 0) * 1000,
                        orderIndex = x.Id,
                        content = new { id = x.Id, name = x.Url, url = x.Url, requiresInteraction = false }
                    })
                    .ToListAsync();
                await RealtimeHub.SendToDevice(device.DeviceId, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = nextPid, items });
            }
        }
    }

    // Content
    public async Task<object> CreateContentAsync(CreateContentDto dto)
    {
        var c = new ContentItem
        {
            Name = dto.Name,
            Url = dto.Url,
            UsernameSelector = dto.UsernameSelector,
            PasswordSelector = dto.PasswordSelector,
            SubmitSelector = dto.SubmitSelector,
            Username = dto.Username,
            Password = dto.Password,
            AutoLogin = dto.AutoLogin ?? false
        };
        _db.Content.Add(c);
        await _db.SaveChangesAsync();
        return new
        {
            id = c.Id,
            name = c.Name,
            url = c.Url,
            usernameSelector = c.UsernameSelector,
            passwordSelector = c.PasswordSelector,
            submitSelector = c.SubmitSelector,
            username = c.Username,
            password = c.Password,
            autoLogin = c.AutoLogin
        };
    }

    public async Task<IEnumerable<object>> GetAllContentAsync()
    {
        return await _db.Content.OrderBy(c => c.Id)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                url = c.Url,
                usernameSelector = c.UsernameSelector,
                passwordSelector = c.PasswordSelector,
                submitSelector = c.SubmitSelector,
                username = c.Username,
                password = c.Password,
                autoLogin = c.AutoLogin
            })
            .ToListAsync();
    }

    public async Task<object?> GetContentAsync(int id)
    {
        var c = await _db.Content.FindAsync(id);
        return c == null ? null : new
        {
            id = c.Id,
            name = c.Name,
            url = c.Url,
            usernameSelector = c.UsernameSelector,
            passwordSelector = c.PasswordSelector,
            submitSelector = c.SubmitSelector,
            username = c.Username,
            password = c.Password,
            autoLogin = c.AutoLogin
        };
    }

    public async Task<object> UpdateContentAsync(int id, UpdateContentDto dto)
    {
        var c = await _db.Content.FindAsync(id);
        if (c == null) return new { error = "not_found" };
        if (!string.IsNullOrWhiteSpace(dto.Name)) c.Name = dto.Name!;
        if (!string.IsNullOrWhiteSpace(dto.Url)) c.Url = dto.Url!;
        await _db.SaveChangesAsync();
        return new { id = c.Id, name = c.Name, url = c.Url };
    }

    public async Task RemoveContentAsync(int id)
    {
        var c = await _db.Content.FindAsync(id);
        if (c == null) return;
        _db.Content.Remove(c);
        await _db.SaveChangesAsync();
    }
}

public class ScreenshotService : IScreenshotService
{
    private readonly PdsDbContext _db;
    public ScreenshotService(PdsDbContext db) => _db = db;

    public async Task<object?> GetLatestAsync(string deviceId)
    {
        var s = await _db.Screenshots.Where(x => x.DeviceStringId == deviceId)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();
        return s == null ? null : new { id = s.Id, deviceId = s.DeviceStringId, url = s.CurrentUrl, capturedAt = s.CreatedAt, imageData = s.ImageBase64 };
    }

    public async Task<IEnumerable<object>> GetByDeviceAsync(string deviceId)
    {
        return await _db.Screenshots.Where(x => x.DeviceStringId == deviceId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(s => new { id = s.Id, deviceId = s.DeviceStringId, url = s.CurrentUrl, capturedAt = s.CreatedAt, imageData = s.ImageBase64 })
            .ToListAsync();
    }

    public async Task<object?> GetByIdAsync(int id)
    {
        var s = await _db.Screenshots.FindAsync(id);
        return s == null ? null : new { id = s.Id, deviceId = s.DeviceStringId, url = s.CurrentUrl, capturedAt = s.CreatedAt, imageData = s.ImageBase64 };
    }
}

// Removed duplicate DbContext; using PDS.Api.PdsDbContext from Entities.cs

public static class RealtimeHub
{
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Net.WebSockets.WebSocket> Devices = new();
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, System.Net.WebSockets.WebSocket> Admins = new();

    public static async Task HandleAsync(HttpContext ctx, System.Net.WebSockets.WebSocket ws)
    {
        var role = (ctx.Request.Query["role"].ToString() ?? "admin").ToLowerInvariant();
        var deviceId = ctx.Items.ContainsKey("__resolvedDeviceId")
            ? ctx.Items["__resolvedDeviceId"]?.ToString()
            : ctx.Request.Query["deviceId"].ToString();

        if (role == "device" && !string.IsNullOrEmpty(deviceId))
        {
            Devices[deviceId] = ws;
            // Notify admins that device is online
            BroadcastAdmins("admin:device:status", new { deviceId, status = "online", timestamp = DateTime.UtcNow });

            // On connect, push current assigned playlist content to the device
            try
            {
                var db = ctx.RequestServices.GetRequiredService<PdsDbContext>();
                var assigned = await db.DevicePlaylists.Where(x => x.DeviceId == db.Devices.Where(d => d.DeviceId == deviceId).Select(d => d.Id).FirstOrDefault())
                    .Select(x => x.PlaylistId)
                    .FirstOrDefaultAsync();
                if (assigned != 0)
                {
                    var items = await db.PlaylistItems.Where(i => i.PlaylistId == assigned)
                        .OrderBy(i => i.OrderIndex ?? i.Id)
                        .Select(i => new {
                            id = i.Id,
                            playlistId = i.PlaylistId,
                            contentId = i.ContentId,
                            displayDuration = (i.DurationSeconds ?? 0) * 1000,
                            orderIndex = i.OrderIndex ?? 0,
                            content = new { id = i.ContentId, name = i.Url, url = i.Url, requiresInteraction = false }
                        })
                        .ToListAsync();
                    await Send(ws, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = assigned, items });
                }
            }
            catch (Exception ex)
            {
                // swallow errors to avoid disconnect on startup
                BroadcastAdmins("admin:error", new { deviceId, error = "content_push_failed", detail = ex.Message, timestamp = DateTime.UtcNow });
            }
        }
        else
        {
            Admins[Guid.NewGuid().ToString()] = ws;
        }

        if (role == "admin")
        {
            await Send(ws, "admin:devices:sync", new { deviceIds = Devices.Keys.ToArray(), timestamp = DateTime.UtcNow });
        }

        var buffer = new byte[64 * 1024];
        while (ws.State == System.Net.WebSockets.WebSocketState.Open)
        {
            using var ms = new System.IO.MemoryStream();
            System.Net.WebSockets.WebSocketReceiveResult result;

            // Read all frames of the message
            do
            {
                result = await ws.ReceiveAsync(buffer: new ArraySegment<byte>(buffer), cancellationToken: CancellationToken.None);
                if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Close)
                {
                    await ws.CloseAsync(System.Net.WebSockets.WebSocketCloseStatus.NormalClosure, "closed", CancellationToken.None);
                    // Notify admins that device is offline
                    if (role == "device" && !string.IsNullOrEmpty(deviceId))
                    {
                        BroadcastAdmins("admin:device:status", new { deviceId, status = "offline", timestamp = DateTime.UtcNow });
                        Devices.TryRemove(deviceId, out _);
                    }
                    return;
                }
                ms.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);

            ms.Seek(0, System.IO.SeekOrigin.Begin);
            var json = Encoding.UTF8.GetString(ms.ToArray());
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var evt = doc.RootElement.GetProperty("event").GetString();
            var payload = doc.RootElement.GetProperty("payload");

            switch (evt)
            {
                case "device:register":
                    // When a device registers, confirm online status to admins
                    BroadcastAdmins("admin:device:status", new { deviceId, status = "online", timestamp = DateTime.UtcNow });

                    try
                    {
                        var db = ctx.RequestServices.GetRequiredService<PdsDbContext>();

                        // FIRST: Send device's display configuration if set
                        // This ensures display is configured before content starts playing
                        var device = await db.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
                        if (device != null)
                        {
                            Serilog.Log.Information($"Device config from DB: Width={device.DisplayWidth}, Height={device.DisplayHeight}, Kiosk={device.KioskMode}");
                            if (device.DisplayWidth.HasValue || device.DisplayHeight.HasValue || device.KioskMode.HasValue)
                            {
                                Serilog.Log.Information($"Sending config update to device {deviceId}");
                                await Send(ws, "config:update", new
                                {
                                    displayWidth = device.DisplayWidth,
                                    displayHeight = device.DisplayHeight,
                                    kioskMode = device.KioskMode
                                });
                                // Wait for display to restart with new config (restart takes ~4s)
                                await Task.Delay(6000);
                            }
                            else
                            {
                                Serilog.Log.Information($"Device {deviceId} has no custom display config set");
                            }
                        }

                        // SECOND: Push playlist content after display is configured
                        var assigned = await db.DevicePlaylists.Where(x => x.DeviceId == db.Devices.Where(d => d.DeviceId == deviceId).Select(d => d.Id).FirstOrDefault())
                            .Select(x => x.PlaylistId)
                            .FirstOrDefaultAsync();
                        if (assigned != 0)
                        {
                            var items = await db.PlaylistItems.Where(i => i.PlaylistId == assigned)
                                .OrderBy(i => i.OrderIndex ?? i.Id)
                                .Select(i => new {
                                    id = i.Id,
                                    playlistId = i.PlaylistId,
                                    contentId = i.ContentId,
                                    displayDuration = (i.DurationSeconds ?? 0) * 1000,
                                    orderIndex = i.OrderIndex ?? 0,
                                    content = new { id = i.ContentId, name = i.Url, url = i.Url, requiresInteraction = false }
                                })
                                .ToListAsync();
                            await Send(ws, ServerToClientEvent.CONTENT_UPDATE, new { playlistId = assigned, items });
                        }
                    }
                    catch (Exception ex)
                    {
                        BroadcastAdmins("admin:error", new { deviceId, error = "content_push_failed", detail = ex.Message, timestamp = DateTime.UtcNow });
                    }
                    break;
                case "health:report":
                    BroadcastAdmins("admin:device:health", new { deviceId, health = payload, timestamp = DateTime.UtcNow });
                    break;
                case "device:status":
                    BroadcastAdmins("admin:device:status", new { deviceId, status = payload.GetProperty("status").GetString(), timestamp = DateTime.UtcNow });
                    break;
                case "error:report":
                    BroadcastAdmins("admin:error", new { deviceId, error = payload.GetProperty("error").GetString(), timestamp = DateTime.UtcNow });
                    break;
                case "screenshot:upload":
                    {
                        try
                        {
                            var imageData = payload.GetProperty("image").GetString() ?? "";
                            var currentUrl = payload.TryGetProperty("currentUrl", out var urlProp) ? urlProp.GetString() : null;

                            var db = ctx.RequestServices.GetRequiredService<PdsDbContext>();

                            var screenshot = new Screenshot
                            {
                                DeviceStringId = deviceId,
                                ImageBase64 = imageData,
                                CurrentUrl = currentUrl,
                                CreatedAt = DateTime.UtcNow
                            };

                            db.Screenshots.Add(screenshot);
                            await db.SaveChangesAsync();

                            BroadcastAdmins("admin:screenshot:received", new { deviceId, screenshotId = screenshot.Id, timestamp = DateTime.UtcNow });
                        }
                        catch (Exception ex)
                        {
                            BroadcastAdmins("admin:error", new { deviceId, error = "screenshot_save_failed", detail = ex.Message, timestamp = DateTime.UtcNow });
                        }
                    }
                    break;
                case "playback:state:update":
                    BroadcastAdmins("admin:playback:state", new { deviceId, state = payload, timestamp = DateTime.UtcNow });
                    break;
                case "screencast:frame":
                    // Forward live screencast frames to admin clients in real-time
                    BroadcastAdmins("admin:screencast:frame", new
                    {
                        deviceId,
                        data = payload.GetProperty("data").GetString(),
                        metadata = payload.GetProperty("metadata")
                    });
                    break;
            }
        }
    }

    public static Task SendToDevice(string deviceId, string evt, object payload)
    {
        if (Devices.TryGetValue(deviceId, out var ws)) return Send(ws, evt, payload);
        return Task.CompletedTask;
    }

    private static Task Send(System.Net.WebSockets.WebSocket ws, string evt, object payload)
    {
        var json = System.Text.Json.JsonSerializer.Serialize(new { @event = evt, payload });
        var bytes = Encoding.UTF8.GetBytes(json);
        return ws.SendAsync(new ArraySegment<byte>(bytes), System.Net.WebSockets.WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private static void BroadcastAdmins(string evt, object payload)
    {
        foreach (var ws in Admins.Values)
        {
            _ = Send(ws, evt, payload);
        }
    }
}
