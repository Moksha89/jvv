using System.Diagnostics;
using Microsoft.Extensions.Logging;
using RemoteAccessAgent.Models;

namespace RemoteAccessAgent.Tunnel;

/// <summary>
/// Manages the FRP client process lifecycle including starting, stopping,
/// monitoring, and restarting the tunnel connection.
/// </summary>
public sealed class TunnelManager : IDisposable
{
    private readonly FrpConfigGenerator _configGenerator;
    private readonly ILogger<TunnelManager> _logger;
    private Process? _frpProcess;
    private bool _isRunning;
    private string? _currentConfigPath;

    public TunnelManager(
        FrpConfigGenerator configGenerator,
        ILogger<TunnelManager> logger)
    {
        _configGenerator = configGenerator;
        _logger = logger;
    }

    /// <summary>
    /// Whether the FRP tunnel process is currently running.
    /// </summary>
    public bool IsRunning => _isRunning && _frpProcess is { HasExited: false };

    /// <summary>
    /// Starts the FRP client tunnel with the given configuration.
    /// </summary>
    public async Task StartAsync(AgentConfiguration config, CancellationToken cancellationToken)
    {
        if (IsRunning)
        {
            _logger.LogWarning("Tunnel is already running. Stopping existing tunnel first.");
            await StopAsync(cancellationToken);
        }

        _logger.LogInformation("Starting FRP tunnel to {Server}:{Port}", config.ServerAddress, config.ServerPort);

        // Generate FRP config
        _currentConfigPath = _configGenerator.GenerateConfig(config);

        // Verify FRP client exists
        if (!File.Exists(config.FrpClientPath))
        {
            _logger.LogError("FRP client not found at {Path}. Please ensure frpc.exe is installed.", config.FrpClientPath);
            throw new FileNotFoundException($"FRP client not found at {config.FrpClientPath}");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = config.FrpClientPath,
            Arguments = $"-c \"{_currentConfigPath}\"",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = Path.GetDirectoryName(config.FrpClientPath) ?? @"C:\Program Files\RemoteAgent"
        };

        _frpProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

        _frpProcess.OutputDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                _logger.LogDebug("[FRP] {Output}", e.Data);
            }
        };

        _frpProcess.ErrorDataReceived += (_, e) =>
        {
            if (!string.IsNullOrEmpty(e.Data))
            {
                _logger.LogWarning("[FRP Error] {Error}", e.Data);
            }
        };

        _frpProcess.Exited += (_, _) =>
        {
            _isRunning = false;
            _logger.LogWarning("FRP client process exited with code {ExitCode}", _frpProcess.ExitCode);
        };

        try
        {
            _frpProcess.Start();
            _frpProcess.BeginOutputReadLine();
            _frpProcess.BeginErrorReadLine();
            _isRunning = true;

            _logger.LogInformation(
                "FRP tunnel started. PID: {Pid}, Local port {LocalPort} -> Remote port {RemotePort}",
                _frpProcess.Id, config.RdpPort, config.RemotePort);

            // Wait briefly to confirm the process didn't immediately crash
            await Task.Delay(2000, cancellationToken);

            if (_frpProcess.HasExited)
            {
                _isRunning = false;
                throw new InvalidOperationException(
                    $"FRP client exited immediately with code {_frpProcess.ExitCode}");
            }
        }
        catch (OperationCanceledException)
        {
            await StopAsync(CancellationToken.None);
            throw;
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Failed to start FRP client process");
            _isRunning = false;
            throw;
        }
    }

    /// <summary>
    /// Stops the FRP client tunnel gracefully.
    /// </summary>
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_frpProcess == null)
        {
            return;
        }

        _logger.LogInformation("Stopping FRP tunnel...");

        try
        {
            if (!_frpProcess.HasExited)
            {
                _frpProcess.Kill(entireProcessTree: true);

                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(10));

                try
                {
                    await _frpProcess.WaitForExitAsync(cts.Token);
                }
                catch (OperationCanceledException)
                {
                    _logger.LogWarning("FRP process did not exit gracefully within timeout");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping FRP tunnel");
        }
        finally
        {
            _isRunning = false;
            _frpProcess.Dispose();
            _frpProcess = null;
            _logger.LogInformation("FRP tunnel stopped");
        }
    }

    public void Dispose()
    {
        if (_frpProcess is { HasExited: false })
        {
            try
            {
                _frpProcess.Kill(entireProcessTree: true);
            }
            catch
            {
                // Best effort cleanup
            }
        }

        _frpProcess?.Dispose();
    }
}
