using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Office.Interop.PowerPoint;

namespace PDS.Api;

public class PowerPointConverter
{
    private readonly ILogger<PowerPointConverter> _logger;
    private readonly string _tempPath;

    public PowerPointConverter(ILogger<PowerPointConverter> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _tempPath = Path.Combine(env.ContentRootPath, "temp");

        if (!Directory.Exists(_tempPath))
        {
            Directory.CreateDirectory(_tempPath);
        }
    }

    public async Task<string> ConvertToVideoAsync(
        string inputPath,
        string outputPath,
        int quality = 2,
        int secondsPerSlide = 5,
        int frameRate = 30,
        CancellationToken cancellationToken = default)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            throw new PlatformNotSupportedException("PowerPoint conversion is only supported on Windows");
        }

        if (!File.Exists(inputPath))
        {
            throw new FileNotFoundException("Input PowerPoint file not found", inputPath);
        }

        Microsoft.Office.Interop.PowerPoint.Application? powerpoint = null;
        Presentation? presentation = null;

        try
        {
            _logger.LogInformation("Starting PowerPoint conversion: {InputPath}", inputPath);

            // Create PowerPoint COM object
            powerpoint = new Microsoft.Office.Interop.PowerPoint.Application();

            // Open presentation (ReadOnly, Untitled, WithWindow set to false for background processing)
            presentation = powerpoint.Presentations.Open(
                inputPath,
                WithWindow: Microsoft.Office.Core.MsoTriState.msoFalse);

            _logger.LogInformation("Opened presentation with {SlideCount} slides", presentation.Slides.Count);

            // Create video
            // Quality: 1=720p, 2=1080p, 3=4K
            presentation.CreateVideo(
                outputPath,
                UseTimingsAndNarrations: false,
                VertResolution: quality,
                FramesPerSecond: frameRate,
                DefaultSlideDuration: secondsPerSlide,
                Quality: 85);

            _logger.LogInformation("Video creation started, waiting for completion...");

            // Wait for conversion to complete
            // CreateVideoStatus: 0=InProgress, 1=Done, 2=Failed
            var timeout = TimeSpan.FromMinutes(30); // 30 minute timeout
            var startTime = DateTime.UtcNow;

            while (presentation.CreateVideoStatus == 0)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    throw new OperationCanceledException("Conversion cancelled by user");
                }

                if (DateTime.UtcNow - startTime > timeout)
                {
                    throw new TimeoutException($"Video conversion timed out after {timeout.TotalMinutes} minutes");
                }

                await Task.Delay(500, cancellationToken);
            }

            if (presentation.CreateVideoStatus == 1)
            {
                var fileInfo = new FileInfo(outputPath);
                _logger.LogInformation(
                    "Video conversion completed successfully. Size: {SizeMB:F2} MB",
                    fileInfo.Length / 1024.0 / 1024.0);

                return outputPath;
            }
            else
            {
                throw new InvalidOperationException($"Video conversion failed with status: {presentation.CreateVideoStatus}");
            }
        }
        catch (COMException ex)
        {
            _logger.LogError(ex, "COM error during PowerPoint conversion");
            throw new InvalidOperationException(
                "PowerPoint conversion failed. Ensure Microsoft PowerPoint is installed and properly licensed on the server.",
                ex);
        }
        finally
        {
            // Cleanup
            try
            {
                presentation?.Close();
                powerpoint?.Quit();

                if (powerpoint != null)
                {
                    Marshal.ReleaseComObject(powerpoint);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error during PowerPoint cleanup");
            }
        }
    }

    /// <summary>
    /// Convert PowerPoint to video with auto-generated filename
    /// </summary>
    public async Task<string> ConvertToVideoAsync(
        Stream inputStream,
        string originalFileName,
        string outputDirectory,
        int quality = 2,
        int secondsPerSlide = 5,
        CancellationToken cancellationToken = default)
    {
        // Save stream to temp file
        var tempInputPath = Path.Combine(_tempPath, $"{Guid.NewGuid()}.pptx");

        try
        {
            await using (var fileStream = File.Create(tempInputPath))
            {
                await inputStream.CopyToAsync(fileStream, cancellationToken);
            }

            // Generate output path
            var outputFileName = $"{Path.GetFileNameWithoutExtension(originalFileName)}.mp4";
            var outputPath = Path.Combine(outputDirectory, outputFileName);

            // Ensure output directory exists
            Directory.CreateDirectory(outputDirectory);

            // Convert
            await ConvertToVideoAsync(tempInputPath, outputPath, quality, secondsPerSlide, cancellationToken: cancellationToken);

            return outputPath;
        }
        finally
        {
            // Clean up temp input file
            try
            {
                if (File.Exists(tempInputPath))
                {
                    File.Delete(tempInputPath);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete temp file: {TempPath}", tempInputPath);
            }
        }
    }
}
