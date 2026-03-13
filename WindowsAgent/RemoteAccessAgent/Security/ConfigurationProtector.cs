using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RemoteAccessAgent.Models;

namespace RemoteAccessAgent.Security;

/// <summary>
/// Handles encrypted storage and retrieval of agent configuration.
/// Uses Windows DPAPI on Windows, or AES fallback on other platforms.
/// </summary>
public sealed class ConfigurationProtector
{
    private readonly ILogger<ConfigurationProtector> _logger;
    private static readonly byte[] FallbackEntropy = "RemoteAccessAgent-Config-Entropy-2024"u8.ToArray();

    public ConfigurationProtector(ILogger<ConfigurationProtector> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Saves the configuration encrypted to the specified file path.
    /// </summary>
    public void SaveConfiguration(AgentConfiguration config, string filePath)
    {
        try
        {
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
            {
                WriteIndented = false
            });
            var plainBytes = Encoding.UTF8.GetBytes(json);
            var encryptedBytes = ProtectData(plainBytes);

            var directory = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            File.WriteAllBytes(filePath, encryptedBytes);
            _logger.LogInformation("Configuration saved to {FilePath}", filePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save configuration to {FilePath}", filePath);
            throw;
        }
    }

    /// <summary>
    /// Loads and decrypts the configuration from the specified file path.
    /// </summary>
    public AgentConfiguration LoadConfiguration(string filePath)
    {
        try
        {
            if (!File.Exists(filePath))
            {
                throw new FileNotFoundException($"Configuration file not found: {filePath}");
            }

            var encryptedBytes = File.ReadAllBytes(filePath);
            var plainBytes = UnprotectData(encryptedBytes);
            var json = Encoding.UTF8.GetString(plainBytes);

            var config = JsonSerializer.Deserialize<AgentConfiguration>(json)
                ?? throw new InvalidOperationException("Failed to deserialize configuration");

            _logger.LogInformation("Configuration loaded from {FilePath}", filePath);
            return config;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load configuration from {FilePath}", filePath);
            throw;
        }
    }

    /// <summary>
    /// Encrypts data using DPAPI on Windows or AES fallback on other platforms.
    /// </summary>
    private byte[] ProtectData(byte[] data)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return ProtectedData.Protect(data, FallbackEntropy, DataProtectionScope.LocalMachine);
        }

        return AesEncrypt(data);
    }

    /// <summary>
    /// Decrypts data using DPAPI on Windows or AES fallback on other platforms.
    /// </summary>
    private byte[] UnprotectData(byte[] data)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return ProtectedData.Unprotect(data, FallbackEntropy, DataProtectionScope.LocalMachine);
        }

        return AesDecrypt(data);
    }

    /// <summary>
    /// AES encryption fallback for non-Windows platforms (development/testing).
    /// </summary>
    private static byte[] AesEncrypt(byte[] data)
    {
        using var aes = Aes.Create();
        var key = DeriveKey(FallbackEntropy, aes.KeySize / 8);
        aes.Key = key;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var encrypted = encryptor.TransformFinalBlock(data, 0, data.Length);

        // Prepend IV to encrypted data
        var result = new byte[aes.IV.Length + encrypted.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(encrypted, 0, result, aes.IV.Length, encrypted.Length);
        return result;
    }

    /// <summary>
    /// AES decryption fallback for non-Windows platforms (development/testing).
    /// </summary>
    private static byte[] AesDecrypt(byte[] data)
    {
        using var aes = Aes.Create();
        var key = DeriveKey(FallbackEntropy, aes.KeySize / 8);
        aes.Key = key;

        var iv = new byte[aes.BlockSize / 8];
        Buffer.BlockCopy(data, 0, iv, 0, iv.Length);
        aes.IV = iv;

        var encrypted = new byte[data.Length - iv.Length];
        Buffer.BlockCopy(data, iv.Length, encrypted, 0, encrypted.Length);

        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(encrypted, 0, encrypted.Length);
    }

    private static byte[] DeriveKey(byte[] entropy, int keyLength)
    {
        using var deriveBytes = new Rfc2898DeriveBytes(entropy, entropy.Reverse().ToArray(), 100000, HashAlgorithmName.SHA256);
        return deriveBytes.GetBytes(keyLength);
    }
}
