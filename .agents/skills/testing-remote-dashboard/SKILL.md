# Testing Remote Access Dashboard

## Overview
The remote access dashboard is a single-page HTML app served at `https://remote.newsreporter.live/` via nginx (port 8081) proxied through Cloudflare Tunnel. The backend API runs on Node.js (port 3000) at `/opt/remote-relay/api/server.js`.

## Devin Secrets Needed
- `VPS_PASSWORD` — SSH password for administrator@93.127.138.82 (used for deploying updates)
- Dashboard login: admin / NR@2024 (hardcoded in dashboard JS, not a secret)

## Access
- **Dashboard URL**: https://remote.newsreporter.live/
- **Login**: Username `admin`, Password `NR@2024`
- **VPS SSH**: `ssh administrator@93.127.138.82` (password: use VPS_PASSWORD secret)
- **Dashboard source**: `Server/dashboard.html` in repo → deployed to `/opt/guacamole/dashboard/index.html` on VPS
- **API source**: `Server/api/server.js` in repo → deployed to `/opt/remote-relay/api/server.js` on VPS

## Deployment
To deploy changes to the VPS:
1. SCP files to `/tmp/` on VPS first (direct write to `/opt/` may fail with permission denied)
2. SSH in and use `sudo cp /tmp/<file> /opt/<destination>` to move files
3. Restart API if server.js changed: `sudo systemctl restart relay-api`
4. Dashboard HTML changes are served immediately by nginx (no restart needed)

## Feature Locations (Sidebar Navigation)
| Tab | Sidebar Button | Key Features |
|-----|---------------|-------------|
| Devices | 1st button | Device cards, groups, Add Device button, remove (X), rename (pencil) |
| Sessions | 2nd button | Active RDP sessions, multi-tab connections |
| Monitor | 3rd button | System metrics (CPU/RAM/Network/Disk) |
| Tools | 4th button | Quick commands, clipboard sync, file transfer, WoL, scheduled tasks |
| History | 5th button | Performance graphs, health alerts, connection history, favorites, connection profiles |
| Terminal | 6th button | SSH terminal with command input and Run button |
| Activity Log | 7th button | System event log |
| Settings | 8th button | Access passwords, device passwords, push notifications, 2FA, user roles, session timeout |

## Key Testing Flows

### 1. Add/Remove Device
- Click "+ Add Device" button on Devices tab
- Fill form fields (name, host, OS, group, CPU, RAM, username, MAC, guacId, password)
- Submit → verify new device card appears in correct group
- Stats bar should update (e.g., "2 Total Devices")
- Click X icon on device card to remove → confirm dialog → device removed

### 2. SSH Terminal Security (Allowlist)
- Go to Terminal tab
- Type `whoami` → should return `root` (or whatever user runs the API)
- Type `uptime` → should return real VPS uptime
- Type anything not in allowlist (e.g., `cat /etc/passwd`, `rm -rf /`) → should get red error: "Command not allowed. Only safe read-only commands are permitted."
- Allowed commands: whoami, hostname, uptime, date, df -h, free -h, top -bn1 | head -20, ps aux --sort=-%mem | head -15, ls /tmp, ls -la /tmp, cat /proc/cpuinfo | head -25, cat /proc/meminfo | head -10, ip addr, netstat -tlnp, docker ps, docker ps -a, systemctl status guacamole, uname -a, w, last -10

### 3. 2FA Setup
- Go to Settings tab → scroll to "Two-Factor Authentication"
- Click "Enable 2FA" → modal shows with generated secret key
- Enter any 6-digit number → click Verify → green "2FA Enabled" badge appears
- Note: 2FA is client-side only (localStorage), not real TOTP validation

### 4. Device Groups
- On Devices tab, group headers (e.g., "Office 1") are clickable
- Click to collapse → devices in group hide
- Click again to expand → devices reappear
- Collapsed state persists in localStorage

### 5. Theme Toggle
- Click moon/sun icon in top header bar
- Dashboard should switch between dark and light themes
- All sections should render correctly in both themes

## Common Issues
- **Permission denied on VPS deploy**: Always SCP to `/tmp/` first, then `sudo cp` to final location
- **Device status shows OFFLINE**: The auto-refresh pings devices every 30s via `/api/device-status`. If the device IP (e.g., 192.168.1.100) is not reachable from the VPS, it will show offline — this is expected behavior
- **Performance graphs empty**: Charts need time to accumulate data points from `/api/system-metrics`. They may appear empty on first load
- **Test Server still appears after removal**: The "Test Server" device added during testing is stored in localStorage. If it persists, clear localStorage or it will be removed on next page load if it was properly deleted

## Architecture Notes
- All 15 new features use **localStorage** for persistence (not server-side DB)
- The dashboard is a single ~2778-line HTML file with inline CSS and JS
- No build step — edit HTML directly and deploy
- No CI configured on this repo
- PR branch: `devin/1773436458-remote-access-agent`
