using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RemoteAccessAgent.Configuration;
using RemoteAccessAgent.Tunnel;

namespace RemoteAccessAgent.Services;

/// <summary>
/// Main background worker service that orchestrates the remote access agent lifecycle:
/// 1. Load encrypted configuration
/// 2. Authenticate with relay server
/// 3. Start reverse tunnel (FRP)
/// 4. Monitor connection and auto-reconnect
/// </summary>
public sealed class RemoteAccessWorker : BackgroundService
{
    private readonly AgentConfigurationManager _configManager;
    private readonly RelayServerClient _relayClient;
    private readonly TunnelManager _tunnelManager;
    private readonly HeartbeatService _heartbeatService;
    private readonly ILogger<RemoteAccessWorker> _logger;
    private readonly IHostApplicationLifetime _appLifetime;

    private int _reconnectAttempts;
    private bool _isReconnecting;

    public RemoteAccessWorker(
        AgentConfigurationManager configManager,
        RelayServerClient relayClient,
        TunnelManager tunnelManager,
        HeartbeatService heartbeatService,
        ILogger<RemoteAccessWorker> logger,
        IHostApplicationLifetime appLifetime)
    {
        _configManager = configManager;
        _relayClient = relayClient;
        _tunnelManager = tunnelManager;
        _heartbeatService = heartbeatService;
        _logger = logger;
        _appLifetime = appLifetime;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RemoteAccessAgent service starting...");

        try
        {
            // Step 1: Load configuration
            if (!await LoadConfigurationAsync(stoppingToken))
            {
                _logger.LogCritical("Failed to load configuration. Service cannot start.");
                _appLifetime.StopApplication();
                return;
            }

            // Subscribe to connection lost events for auto-reconnect
            _heartbeatService.OnConnectionLost += () =>
            {
                if (!_isReconnecting)
                {
                    _ = ReconnectAsync(stoppingToken);
                }
            };

            // Step 2: Initial connection
            await ConnectAsync(stoppingToken);

            // Step 3: Main monitoring loop
            await MonitorConnectionAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Service shutdown requested");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Fatal error in RemoteAccessAgent service");
            _appLifetime.StopApplication();
        }
    }

    /// <summary>
    /// Loads the encrypted agent configuration.
    /// </summary>
    private async Task<bool> LoadConfigurationAsync(CancellationToken cancellationToken)
    {
        try
        {
            _configManager.Load();
            _logger.LogInformation("Configuration loaded successfully. DeviceId: {DeviceId}",
                _configManager.CurrentConfig.DeviceId);
            return true;
        }
        catch (FileNotFoundException)
        {
            _logger.LogError("Configuration file not found. Run the installer to set up the agent.");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load configuration");
            return false;
        }
    }

    /// <summary>
    /// Establishes connection: authenticates with relay server and starts tunnel.
    /// </summary>
    private async Task ConnectAsync(CancellationToken cancellationToken)
    {
        var config = _configManager.CurrentConfig;

        // Configure relay client
        _relayClient.Configure(config.ApiBaseUrl);

        // Step 2a: Authenticate with relay server
        _logger.LogInformation("Authenticating with relay server...");
        try
        {
            var authResponse = await _relayClient.AuthenticateAsync(config, cancellationToken);
            if (!authResponse.Success)
            {
                _logger.LogError("Authentication failed: {Message}", authResponse.Message);
                throw new UnauthorizedAccessException($"Authentication failed: {authResponse.Message}");
            }

            // Update remote port if server assigned a different one
            if (authResponse.AssignedRemotePort > 0 && authResponse.AssignedRemotePort != config.RemotePort)
            {
                _logger.LogInformation("Server assigned remote port {Port}", authResponse.AssignedRemotePort);
                config.RemotePort = authResponse.AssignedRemotePort;
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not reach relay server API. Proceeding with tunnel setup using stored config.");
        }

        // Step 2b: Start reverse tunnel
        _logger.LogInformation("Starting reverse tunnel...");
        await _tunnelManager.StartAsync(config, cancellationToken);

        // Step 2c: Start heartbeat monitoring
        _heartbeatService.Start(_configManager);

        _reconnectAttempts = 0;
        _logger.LogInformation(
            "Agent fully connected. Device {DeviceId} accessible at {Server}:{Port}",
            config.DeviceId, config.ServerAddress, config.RemotePort);
    }

    /// <summary>
    /// Monitors the tunnel connection and triggers reconnection when needed.
    /// </summary>
    private async Task MonitorConnectionAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);

            if (!_tunnelManager.IsRunning && !_isReconnecting)
            {
                _logger.LogWarning("Tunnel process is not running. Initiating reconnect...");
                await ReconnectAsync(cancellationToken);
            }
        }
    }

    /// <summary>
    /// Handles reconnection with exponential backoff.
    /// </summary>
    private async Task ReconnectAsync(CancellationToken cancellationToken)
    {
        if (_isReconnecting)
        {
            return;
        }

        _isReconnecting = true;
        _heartbeatService.Stop();

        try
        {
            var config = _configManager.CurrentConfig;

            while (!cancellationToken.IsCancellationRequested)
            {
                _reconnectAttempts++;

                // Exponential backoff: 5s, 10s, 20s, 40s, ... up to max
                var delay = Math.Min(
                    config.ReconnectDelaySeconds * (int)Math.Pow(2, _reconnectAttempts - 1),
                    config.MaxReconnectDelaySeconds);

                _logger.LogInformation(
                    "Reconnect attempt {Attempt}. Waiting {Delay}s before retry...",
                    _reconnectAttempts, delay);

                await Task.Delay(TimeSpan.FromSeconds(delay), cancellationToken);

                try
                {
                    // Stop existing tunnel if any
                    await _tunnelManager.StopAsync(cancellationToken);

                    // Attempt reconnection
                    await ConnectAsync(cancellationToken);

                    _logger.LogInformation("Reconnected successfully after {Attempts} attempt(s)", _reconnectAttempts);
                    return;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Reconnect attempt {Attempt} failed", _reconnectAttempts);
                }
            }
        }
        finally
        {
            _isReconnecting = false;
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("RemoteAccessAgent service stopping...");

        _heartbeatService.Stop();
        await _tunnelManager.StopAsync(cancellationToken);

        _logger.LogInformation("RemoteAccessAgent service stopped");
        await base.StopAsync(cancellationToken);
    }
}
