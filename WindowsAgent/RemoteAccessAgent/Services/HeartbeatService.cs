using Microsoft.Extensions.Logging;
using RemoteAccessAgent.Configuration;
using RemoteAccessAgent.Tunnel;

namespace RemoteAccessAgent.Services;

/// <summary>
/// Background service that sends periodic heartbeats to the relay server
/// and monitors the tunnel connection health.
/// </summary>
public sealed class HeartbeatService : IDisposable
{
    private readonly RelayServerClient _relayClient;
    private readonly TunnelManager _tunnelManager;
    private readonly ILogger<HeartbeatService> _logger;
    private Timer? _heartbeatTimer;
    private DateTime _serviceStartTime;

    public HeartbeatService(
        RelayServerClient relayClient,
        TunnelManager tunnelManager,
        ILogger<HeartbeatService> logger)
    {
        _relayClient = relayClient;
        _tunnelManager = tunnelManager;
        _logger = logger;
    }

    /// <summary>
    /// Number of consecutive heartbeat failures.
    /// </summary>
    public int ConsecutiveFailures { get; private set; }

    /// <summary>
    /// Event raised when too many heartbeats fail consecutively.
    /// </summary>
    public event Action? OnConnectionLost;

    /// <summary>
    /// Starts the heartbeat timer.
    /// </summary>
    public void Start(AgentConfigurationManager configManager)
    {
        _serviceStartTime = DateTime.UtcNow;
        var config = configManager.CurrentConfig;
        var interval = TimeSpan.FromSeconds(config.HeartbeatIntervalSeconds);

        _heartbeatTimer = new Timer(
            async _ => await SendHeartbeatAsync(configManager),
            null,
            TimeSpan.FromSeconds(5), // Initial delay
            interval);

        _logger.LogInformation("Heartbeat service started with {Interval}s interval", config.HeartbeatIntervalSeconds);
    }

    /// <summary>
    /// Stops the heartbeat timer.
    /// </summary>
    public void Stop()
    {
        _heartbeatTimer?.Change(Timeout.Infinite, Timeout.Infinite);
        _logger.LogInformation("Heartbeat service stopped");
    }

    private async Task SendHeartbeatAsync(AgentConfigurationManager configManager)
    {
        try
        {
            var config = configManager.CurrentConfig;
            var uptimeMinutes = (DateTime.UtcNow - _serviceStartTime).TotalMinutes;

            var success = await _relayClient.SendHeartbeatAsync(
                config,
                _tunnelManager.IsRunning,
                uptimeMinutes,
                CancellationToken.None);

            if (success)
            {
                ConsecutiveFailures = 0;
            }
            else
            {
                ConsecutiveFailures++;
                _logger.LogWarning("Heartbeat failed. Consecutive failures: {Count}", ConsecutiveFailures);

                if (ConsecutiveFailures >= 5)
                {
                    _logger.LogError("Too many consecutive heartbeat failures. Triggering reconnect.");
                    OnConnectionLost?.Invoke();
                }
            }
        }
        catch (Exception ex)
        {
            ConsecutiveFailures++;
            _logger.LogError(ex, "Error sending heartbeat. Consecutive failures: {Count}", ConsecutiveFailures);

            if (ConsecutiveFailures >= 5)
            {
                OnConnectionLost?.Invoke();
            }
        }
    }

    public void Dispose()
    {
        _heartbeatTimer?.Dispose();
    }
}
