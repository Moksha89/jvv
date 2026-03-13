# Windows Remote Access Agent with Cloud Relay (CGNAT Bypass)

A professional remote access infrastructure that allows a Windows PC located behind CGNAT (such as UAE ISP networks) to be accessed securely from anywhere through a cloud VPS relay server. The system automatically starts on boot, maintains a persistent outbound tunnel, and allows secure Remote Desktop access without port forwarding.

## Architecture

```
Remote Client (Laptop / Phone)
    → Cloud VPS Relay Server (FRP Server + REST API)
        → Windows Agent (Home PC behind CGNAT)
```

The Windows machine connects **outward** to the VPS, creating a persistent reverse tunnel so that remote users can connect through the VPS to reach the home PC.

## Components

### 1. Windows Agent (`WindowsAgent/`)

A C# .NET 8 Windows Service that:

- Starts automatically at system boot
- Runs without user login
- Maintains persistent outbound connection to VPS
- Creates reverse tunnel for Remote Desktop (RDP) via FRP
- Automatically reconnects if connection drops (exponential backoff)
- Sends periodic heartbeat to server (every 30 seconds)
- Securely stores configuration using Windows DPAPI
- Logs all activity with daily rolling log files

**Key Classes:**
- `RemoteAccessWorker` - Main service orchestrator
- `TunnelManager` - FRP client process lifecycle management
- `HeartbeatService` - Periodic heartbeat monitoring
- `RelayServerClient` - REST API communication
- `ConfigurationProtector` - DPAPI-based encryption
- `AgentConfigurationManager` - Configuration lifecycle

### 2. Cloud Relay Server (`Server/`)

Ubuntu VPS components:

- **FRP Server** - Accepts reverse tunnel connections from Windows agents
- **REST API** (Node.js/Express) - Device authentication, registration, heartbeat monitoring
- **SQLite Database** - Device registry, heartbeat logs, auth logs
- **Systemd Services** - Auto-start on boot with restart-on-failure

### 3. Installer Scripts

- `Install-RemoteAgent.ps1` - Windows agent installer (downloads FRP, creates config, installs service)
- `Uninstall-RemoteAgent.ps1` - Clean uninstaller
- `setup-server.sh` - VPS one-command setup script
- `manage-devices.sh` - Device management CLI tool

## Quick Start

### Step 1: Set Up the VPS Relay Server

On your Ubuntu 22.04 VPS:

```bash
# Clone the repository
git clone https://github.com/Moksha89/remote-access-agent.git
cd remote-access-agent/Server

# Run the setup script (as root)
sudo bash scripts/setup-server.sh
```

The script will:
- Install Node.js and dependencies
- Download and configure FRP server
- Create systemd services
- Configure the firewall
- Generate authentication credentials

**Save the Auth Token** displayed at the end - you'll need it for the Windows agent.

### Step 2: Install the Windows Agent

On your Windows PC (requires Administrator):

```powershell
# Build the project first (requires .NET 8 SDK)
cd WindowsAgent
dotnet publish -c Release

# Run the installer
cd Installer
.\Install-RemoteAgent.ps1 `
    -ServerAddress "YOUR_VPS_IP" `
    -AuthToken "YOUR_AUTH_TOKEN" `
    -RemotePort 33890
```

The installer will:
- Download and install the FRP client
- Create encrypted configuration
- Install the Windows service with auto-restart
- Configure firewall rules

### Step 3: Start the Service

```powershell
Start-Service RemoteAccessAgent
```

### Step 4: Connect Remotely

From any device, use Microsoft Remote Desktop to connect to:

```
VPS_IP:33890
```

Use your Windows PC's username and password to log in.

## Configuration

### Windows Agent Configuration

The agent configuration is stored encrypted at:
```
%ProgramData%\RemoteAgent\config.dat
```

Fields:

| Field | Description | Default |
|-------|-------------|---------|
| `DeviceId` | Unique device identifier | Auto-generated |
| `ServerAddress` | VPS hostname or IP | Required |
| `ServerPort` | FRP server port | 7000 |
| `AuthToken` | Authentication token | Required |
| `RdpPort` | Local RDP port | 3389 |
| `RemotePort` | VPS port for RDP access | 33890 |
| `HeartbeatIntervalSeconds` | Heartbeat frequency | 30 |
| `ReconnectDelaySeconds` | Initial reconnect delay | 5 |
| `MaxReconnectDelaySeconds` | Max reconnect delay (backoff cap) | 300 |
| `EnableTls` | TLS for FRP connection | true |

### Server Configuration

FRP server config: `/opt/remote-relay/frps.toml`

See `Server/config/example-frps.toml` for all options.

## Security

- **TLS encryption** on all tunnel traffic
- **Unique device IDs** for each agent
- **Token-based authentication** for FRP and REST API
- **No inbound ports** required on the home network
- **Only outbound connections** from the Windows agent
- **Windows DPAPI** for credential storage (machine-level)
- **Firewall rules** configured automatically on both ends
- **Self-signed cert support** for development environments

## Reliability

- **Auto-reconnect** after internet failure (exponential backoff: 5s → 300s)
- **Auto-reconnect** after PC reboot (Windows Service auto-start)
- **Auto-restart** on service crash (Windows SCM recovery: 5s/10s/30s)
- **Heartbeat monitoring** every 30 seconds
- **Stale device detection** (marked offline after 2 minutes of missed heartbeats)
- **Rolling log files** with 30-day retention

## Server Management

### Check Service Status

```bash
# On VPS
systemctl status frps
systemctl status relay-api

# View logs
journalctl -u frps -f
journalctl -u relay-api -f
```

### Device Management

```bash
cd /opt/remote-relay

# List all devices
./manage-devices.sh list

# Check specific device
./manage-devices.sh status DEVICE_ID

# Register a new device manually
./manage-devices.sh register DEVICE_ID AUTH_TOKEN

# Check server health
./manage-devices.sh health
```

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/devices/auth` | Device authentication |
| POST | `/api/devices/heartbeat` | Heartbeat update |
| GET | `/api/devices` | List all devices |
| GET | `/api/devices/:id` | Get device details |
| POST | `/api/devices/register` | Register new device |
| DELETE | `/api/devices/:id` | Delete device |

## Windows Agent Service Management

```powershell
# Start/Stop/Restart
Start-Service RemoteAccessAgent
Stop-Service RemoteAccessAgent
Restart-Service RemoteAccessAgent

# Check status
Get-Service RemoteAccessAgent

# View logs
Get-Content "$env:ProgramData\RemoteAgent\Logs\agent-*.log" -Tail 100

# View FRP logs
Get-Content "$env:ProgramData\RemoteAgent\frpc.log" -Tail 100
```

## Building from Source

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (for Windows Agent)
- [Node.js 20+](https://nodejs.org/) (for Server API)

### Build Windows Agent

```bash
cd WindowsAgent
dotnet restore
dotnet build -c Release
dotnet publish -c Release
```

Published output: `WindowsAgent/RemoteAccessAgent/bin/Release/net8.0-windows/win-x64/publish/`

### Build Server API

```bash
cd Server/api
npm install
```

## Project Structure

```
remote-access-agent/
├── WindowsAgent/
│   ├── RemoteAccessAgent.sln
│   ├── RemoteAccessAgent/
│   │   ├── RemoteAccessAgent.csproj
│   │   ├── Program.cs                  # Entry point, DI setup
│   │   ├── appsettings.json
│   │   ├── Models/
│   │   │   ├── AgentConfiguration.cs   # Config model
│   │   │   ├── AuthRequest.cs          # Auth request payload
│   │   │   ├── AuthResponse.cs         # Auth response payload
│   │   │   ├── DeviceInfo.cs           # Device info model
│   │   │   └── HeartbeatRequest.cs     # Heartbeat payload
│   │   ├── Configuration/
│   │   │   └── ConfigurationManager.cs # Config lifecycle
│   │   ├── Security/
│   │   │   └── ConfigurationProtector.cs # DPAPI encryption
│   │   ├── Tunnel/
│   │   │   ├── FrpConfigGenerator.cs   # FRP TOML config generation
│   │   │   └── TunnelManager.cs        # FRP process management
│   │   └── Services/
│   │       ├── RemoteAccessWorker.cs   # Main worker service
│   │       ├── HeartbeatService.cs     # Heartbeat monitor
│   │       └── RelayServerClient.cs    # REST API client
│   └── Installer/
│       ├── Install-RemoteAgent.ps1     # Windows installer
│       ├── Uninstall-RemoteAgent.ps1   # Windows uninstaller
│       └── example-config.json         # Example config
├── Server/
│   ├── api/
│   │   ├── package.json
│   │   └── server.js                   # Express REST API
│   ├── config/
│   │   ├── frps.toml                   # FRP server config
│   │   └── example-frps.toml           # Example config
│   └── scripts/
│       ├── setup-server.sh             # VPS setup script
│       └── manage-devices.sh           # Device management CLI
└── docs/
    └── VPS-DEPLOYMENT-GUIDE.md         # Detailed deployment guide
```

## Phase 2 Enhancements (Future)

- [ ] Web dashboard for device monitoring
- [ ] Device online/offline status with notifications
- [ ] Remote command execution
- [ ] File transfer capability
- [ ] Multiple device management with groups
- [ ] Auto-update system for the Windows agent
- [ ] Two-factor authentication
- [ ] Connection bandwidth monitoring

## Troubleshooting

### Agent won't connect
1. Check if FRP client exists: `Test-Path "C:\Program Files\RemoteAgent\frpc.exe"`
2. Check agent logs: `Get-Content "$env:ProgramData\RemoteAgent\Logs\agent-*.log" -Tail 50`
3. Verify VPS is reachable: `Test-NetConnection YOUR_VPS_IP -Port 7000`

### Service crashes on start
1. Check Windows Event Viewer → Application logs
2. Verify configuration exists: `Test-Path "$env:ProgramData\RemoteAgent\config.dat"`
3. Run as console for debugging: `RemoteAccessAgent.exe` (from install directory)

### RDP connection fails
1. Verify Windows RDP is enabled on the home PC
2. Check tunnel status via FRP dashboard
3. Verify the correct remote port is assigned
4. Check VPS firewall: `sudo ufw status`

## License

MIT License
