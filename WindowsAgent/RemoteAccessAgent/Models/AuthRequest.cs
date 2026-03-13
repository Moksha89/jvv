namespace RemoteAccessAgent.Models;

/// <summary>
/// Authentication request sent to the relay server on connect.
/// </summary>
public sealed class AuthRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;
    public string Hostname { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = string.Empty;
    public string OsVersion { get; set; } = string.Empty;
}
