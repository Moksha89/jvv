using Microsoft.Extensions.Logging;
using RemoteAccessAgent.Models;
using RemoteAccessAgent.Security;

namespace RemoteAccessAgent.Configuration;

/// <summary>
/// Manages agent configuration lifecycle including loading, saving,
/// and providing access to the current configuration.
/// </summary>
public sealed class AgentConfigurationManager
{
    private readonly ConfigurationProtector _protector;
    private readonly ILogger<AgentConfigurationManager> _logger;
    private AgentConfiguration? _currentConfig;

    private static readonly string DefaultConfigPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "RemoteAgent", "config.dat"
    );

    public AgentConfigurationManager(
        ConfigurationProtector protector,
        ILogger<AgentConfigurationManager> logger)
    {
        _protector = protector;
        _logger = logger;
    }

    /// <summary>
    /// Gets the current loaded configuration. Throws if not yet loaded.
    /// </summary>
    public AgentConfiguration CurrentConfig =>
        _currentConfig ?? throw new InvalidOperationException("Configuration has not been loaded yet.");

    /// <summary>
    /// Loads configuration from the default or specified path.
    /// </summary>
    public AgentConfiguration Load(string? configPath = null)
    {
        var path = configPath ?? DefaultConfigPath;
        _logger.LogInformation("Loading configuration from {Path}", path);
        _currentConfig = _protector.LoadConfiguration(path);
        return _currentConfig;
    }

    /// <summary>
    /// Saves the current configuration to the default or specified path.
    /// </summary>
    public void Save(AgentConfiguration config, string? configPath = null)
    {
        var path = configPath ?? DefaultConfigPath;
        _logger.LogInformation("Saving configuration to {Path}", path);
        _protector.SaveConfiguration(config, path);
        _currentConfig = config;
    }

    /// <summary>
    /// Creates and saves a default configuration. Used for initial setup.
    /// </summary>
    public AgentConfiguration CreateDefault(
        string serverAddress,
        int serverPort,
        string authToken,
        int remotePort,
        string? configPath = null)
    {
        var config = new AgentConfiguration
        {
            DeviceId = Guid.NewGuid().ToString("N")[..12].ToUpperInvariant(),
            ServerAddress = serverAddress,
            ServerPort = serverPort,
            AuthToken = authToken,
            RdpPort = 3389,
            RemotePort = remotePort,
            HeartbeatIntervalSeconds = 30,
            ReconnectDelaySeconds = 5,
            MaxReconnectDelaySeconds = 300,
            EnableTls = true,
            ApiBaseUrl = $"https://{serverAddress}:3000"
        };

        Save(config, configPath);
        _logger.LogInformation("Default configuration created with DeviceId: {DeviceId}", config.DeviceId);
        return config;
    }

    /// <summary>
    /// Checks if a configuration file exists at the default or specified path.
    /// </summary>
    public static bool ConfigurationExists(string? configPath = null)
    {
        var path = configPath ?? DefaultConfigPath;
        return File.Exists(path);
    }
}
