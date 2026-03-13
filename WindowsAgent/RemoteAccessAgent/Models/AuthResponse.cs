namespace RemoteAccessAgent.Models;

/// <summary>
/// Authentication response from the relay server.
/// </summary>
public sealed class AuthResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int AssignedRemotePort { get; set; }
}
