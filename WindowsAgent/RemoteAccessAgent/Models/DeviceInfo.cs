namespace RemoteAccessAgent.Models;

/// <summary>
/// Device information sent to the relay server for registration and heartbeats.
/// </summary>
public sealed class DeviceInfo
{
    public string DeviceId { get; set; } = string.Empty;
    public string Hostname { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = string.Empty;
    public string OsVersion { get; set; } = string.Empty;
    public DateTime LastHeartbeat { get; set; } = DateTime.UtcNow;
    public bool IsOnline { get; set; }
    public int RemotePort { get; set; }
}
