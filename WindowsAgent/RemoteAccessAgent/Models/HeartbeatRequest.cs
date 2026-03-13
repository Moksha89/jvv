namespace RemoteAccessAgent.Models;

/// <summary>
/// Heartbeat payload sent to the relay server periodically.
/// </summary>
public sealed class HeartbeatRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public bool TunnelActive { get; set; }
    public string AgentVersion { get; set; } = string.Empty;
    public double UptimeMinutes { get; set; }
}
