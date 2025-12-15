using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace PDS.Api;

public interface IVideoService
{
    Task<ContentItem> ProcessAndCreateAsync(IFormFile file, string name);
}

public class VideoService : IVideoService
{
    private readonly PdsDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<VideoService> _logger;

    public VideoService(PdsDbContext db, IWebHostEnvironment env, ILogger<VideoService> logger)
    {
        _db = db;
        _env = env;
        _logger = logger;
    }

    public async Task<ContentItem> ProcessAndCreateAsync(IFormFile file, string name)
    {
        var storageId = Guid.NewGuid().ToString();
        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var outputDir = Path.Combine(webRoot, "videos", storageId);
        Directory.CreateDirectory(outputDir);

        // 1. Save video file
        var extension = Path.GetExtension(file.FileName);
        var videoFileName = $"video{extension}";
        var videoPath = Path.Combine(outputDir, videoFileName);

        using (var stream = new FileStream(videoPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // 2. Get Duration using ffprobe
        double durationSeconds = 0;
        try 
        {
            var durationStr = await RunCommandAsync("ffprobe", $"-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 \"{videoPath}\"");
            if (double.TryParse(durationStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double d))
            {
                durationSeconds = d;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get video duration");
            // Fallback default
            durationSeconds = 30;
        }

        // 3. Generate index.html wrapper
        var html = $@"<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{name}</title>
    <style>
        body, html {{ margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: black; }}
        video {{ width: 100%; height: 100%; object-fit: contain; }}
    </style>
</head>
<body>
    <video id=""player"" src=""{videoFileName}"" autoplay muted playsinline></video>
    <script>
        const video = document.getElementById('player');
        // Optional: Reload page when video ends to ensure loop if playlist logic doesn't catch it?
        // Or just let it sit there. The playlist executor should handle the timing.
        // Actually, for single item playlists, we might want it to loop.
        // But usually the playlist executor will reload the page or move to next item.
        
        // Ensure it plays
        video.play().catch(e => console.error('Autoplay failed:', e));
    </script>
</body>
</html>";

        await File.WriteAllTextAsync(Path.Combine(outputDir, "index.html"), html);

        // 4. Create ContentItem
        // Url points to the static file index.html
        var content = new ContentItem
        {
            Name = name,
            Url = $"/videos/{storageId}/index.html",
            DefaultDuration = (int)Math.Ceiling(durationSeconds)
        };

        _db.Content.Add(content);
        await _db.SaveChangesAsync();

        return content;
    }

    private async Task<string> RunCommandAsync(string command, string args)
    {
        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = command,
                Arguments = args,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        process.Start();
        var output = await process.StandardOutput.ReadToEndAsync();
        var error = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        if (process.ExitCode != 0)
        {
            _logger.LogError("Command failed: {Command} {Args}. Error: {Error}", command, args, error);
            throw new Exception($"Command failed with exit code {process.ExitCode}: {error}");
        }

        return output.Trim();
    }
}
