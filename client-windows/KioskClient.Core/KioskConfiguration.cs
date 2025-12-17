namespace KioskClient.Core;

public class KioskConfiguration
{
    public string ServerUrl { get; set; } = "http://localhost:5001";
    public string DeviceId { get; set; } = Environment.MachineName;
    public string DeviceToken { get; set; } = string.Empty;
    public int HealthReportIntervalMs { get; set; } = 60000; // 60 seconds
    public int ScreenshotIntervalMs { get; set; } = 300000; // 5 minutes
    public bool Headless { get; set; } = false;
    public int ViewportWidth { get; set; } = 1920;
    public int ViewportHeight { get; set; } = 1080;
}
