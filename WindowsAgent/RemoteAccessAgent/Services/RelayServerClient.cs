using System.Net.Http.Json;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RemoteAccessAgent.Models;

namespace RemoteAccessAgent.Services;

/// <summary>
/// HTTP client for communicating with the relay server REST API.
/// Handles authentication, heartbeats, and device registration.
/// </summary>
public sealed class RelayServerClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<RelayServerClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RelayServerClient(
        IHttpClientFactory httpClientFactory,
        ILogger<RelayServerClient> logger)
    {
        _httpClient = httpClientFactory.CreateClient("RelayServer");
        _logger = logger;
    }

    /// <summary>
    /// Configures the client with the relay server base URL.
    /// </summary>
    public void Configure(string baseUrl)
    {
        _httpClient.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", $"RemoteAccessAgent/{GetAgentVersion()}");
        _logger.LogInformation("Relay server client configured with base URL: {BaseUrl}", baseUrl);
    }

    /// <summary>
    /// Authenticates the device with the relay server.
    /// </summary>
    public async Task<AuthResponse> AuthenticateAsync(AgentConfiguration config, CancellationToken cancellationToken)
    {
        var request = new AuthRequest
        {
            DeviceId = config.DeviceId,
            AuthToken = config.AuthToken,
            Hostname = Environment.MachineName,
            AgentVersion = GetAgentVersion(),
            OsVersion = RuntimeInformation.OSDescription
        };

        try
        {
            _logger.LogInformation("Authenticating device {DeviceId} with relay server...", config.DeviceId);
            var response = await _httpClient.PostAsJsonAsync("api/devices/auth", request, JsonOptions, cancellationToken);
            response.EnsureSuccessStatusCode();

            var authResponse = await response.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions, cancellationToken)
                ?? throw new InvalidOperationException("Empty authentication response");

            if (authResponse.Success)
            {
                _logger.LogInformation("Authentication successful for device {DeviceId}", config.DeviceId);
            }
            else
            {
                _logger.LogWarning("Authentication failed for device {DeviceId}: {Message}",
                    config.DeviceId, authResponse.Message);
            }

            return authResponse;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to authenticate with relay server");
            throw;
        }
    }

    /// <summary>
    /// Sends a heartbeat to the relay server.
    /// </summary>
    public async Task<bool> SendHeartbeatAsync(
        AgentConfiguration config,
        bool tunnelActive,
        double uptimeMinutes,
        CancellationToken cancellationToken)
    {
        var heartbeat = new HeartbeatRequest
        {
            DeviceId = config.DeviceId,
            AuthToken = config.AuthToken,
            Timestamp = DateTime.UtcNow,
            TunnelActive = tunnelActive,
            AgentVersion = GetAgentVersion(),
            UptimeMinutes = uptimeMinutes
        };

        try
        {
            var response = await _httpClient.PostAsJsonAsync("api/devices/heartbeat", heartbeat, JsonOptions, cancellationToken);
            response.EnsureSuccessStatusCode();
            _logger.LogDebug("Heartbeat sent successfully for device {DeviceId}", config.DeviceId);
            return true;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Failed to send heartbeat to relay server");
            return false;
        }
        catch (TaskCanceledException)
        {
            return false;
        }
    }

    private static string GetAgentVersion()
    {
        return typeof(RelayServerClient).Assembly.GetName().Version?.ToString() ?? "1.0.0";
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
