namespace RemoteAccessAgent.Models;

/// <summary>
/// Represents the agent configuration stored as encrypted JSON.
/// </summary>
public sealed class AgentConfiguration
{
    /// <summary>
    /// Unique identifier for this device.
    /// </summary>
    public string DeviceId { get; set; } = string.Empty;

    /// <summary>
    /// Address of the relay server (hostname or IP).
    /// </summary>
    public string ServerAddress { get; set; } = string.Empty;

    /// <summary>
    /// Port on which the FRP server listens.
    /// </summary>
    public int ServerPort { get; set; } = 7000;

    /// <summary>
    /// Authentication token for the relay server.
    /// </summary>
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>
    /// Local RDP port to expose through the tunnel (default 3389).
    /// </summary>
    public int RdpPort { get; set; } = 3389;

    /// <summary>
    /// Remote port assigned on the VPS for this device's RDP access.
    /// </summary>
    public int RemotePort { get; set; } = 33890;

    /// <summary>
    /// Heartbeat interval in seconds.
    /// </summary>
    public int HeartbeatIntervalSeconds { get; set; } = 30;

    /// <summary>
    /// Reconnect delay in seconds after a connection failure.
    /// </summary>
    public int ReconnectDelaySeconds { get; set; } = 5;

    /// <summary>
    /// Maximum reconnect delay in seconds (exponential backoff cap).
    /// </summary>
    public int MaxReconnectDelaySeconds { get; set; } = 300;

    /// <summary>
    /// Path to the FRP client executable.
    /// </summary>
    public string FrpClientPath { get; set; } = @"C:\Program Files\RemoteAgent\frpc.exe";

    /// <summary>
    /// Enable TLS for FRP connection.
    /// </summary>
    public bool EnableTls { get; set; } = true;

    /// <summary>
    /// REST API base URL for the relay server.
    /// </summary>
    public string ApiBaseUrl { get; set; } = string.Empty;
}
