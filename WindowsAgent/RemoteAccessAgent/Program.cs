using RemoteAccessAgent.Configuration;
using RemoteAccessAgent.Security;
using RemoteAccessAgent.Services;
using RemoteAccessAgent.Tunnel;
using Serilog;

namespace RemoteAccessAgent;

/// <summary>
/// Entry point for the RemoteAccessAgent Windows Service.
/// Configures dependency injection, logging, and service registration.
/// </summary>
public class Program
{
    public static void Main(string[] args)
    {
        // Configure Serilog
        var logPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "RemoteAgent", "Logs", "agent-.log");

        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft", Serilog.Events.LogEventLevel.Warning)
            .MinimumLevel.Override("System", Serilog.Events.LogEventLevel.Warning)
            .WriteTo.Console()
            .WriteTo.File(
                logPath,
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 30,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
            .CreateLogger();

        try
        {
            Log.Information("Starting RemoteAccessAgent service...");

            var builder = Host.CreateApplicationBuilder(args);

            // Use Serilog for logging
            builder.Services.AddSerilog();

            // Register HTTP client factory
            builder.Services.AddHttpClient("RelayServer", client =>
            {
                client.Timeout = TimeSpan.FromSeconds(30);
            })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (_, _, _, _) => true // Allow self-signed certs in dev
            });

            // Register services
            builder.Services.AddSingleton<ConfigurationProtector>();
            builder.Services.AddSingleton<AgentConfigurationManager>();
            builder.Services.AddSingleton<FrpConfigGenerator>();
            builder.Services.AddSingleton<TunnelManager>();
            builder.Services.AddSingleton<RelayServerClient>();
            builder.Services.AddSingleton<HeartbeatService>();

            // Register the main worker service
            builder.Services.AddHostedService<RemoteAccessWorker>();

            // Configure as Windows Service
            builder.Services.AddWindowsService(options =>
            {
                options.ServiceName = "RemoteAccessAgent";
            });

            var host = builder.Build();
            host.Run();
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "RemoteAccessAgent service terminated unexpectedly");
        }
        finally
        {
            Log.CloseAndFlush();
        }
    }
}
