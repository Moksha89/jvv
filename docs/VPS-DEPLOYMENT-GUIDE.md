# VPS Deployment Guide

Complete guide for setting up the Remote Access Relay Server on a cloud VPS.

## Prerequisites

- Ubuntu 22.04 LTS VPS (any cloud provider: DigitalOcean, Vultr, Linode, AWS, etc.)
- Root or sudo access
- Public IP address
- Minimum 1 GB RAM, 1 vCPU

## Recommended VPS Providers

| Provider | Minimum Plan | Cost (approx.) |
|----------|-------------|-----------------|
| DigitalOcean | Basic Droplet 1GB | $6/month |
| Vultr | Cloud Compute 1GB | $6/month |
| Linode | Nanode 1GB | $5/month |
| AWS Lightsail | 1GB | $5/month |

## Step-by-Step Setup

### 1. Initial Server Setup

```bash
# Connect to your VPS
ssh root@YOUR_VPS_IP

# Update system
apt update && apt upgrade -y

# Create a non-root user (recommended)
adduser relay-admin
usermod -aG sudo relay-admin

# Set up SSH key authentication (recommended)
# Copy your public key to the server
```

### 2. Clone Repository and Run Setup

```bash
# Install git
apt install -y git

# Clone the project
git clone https://github.com/Moksha89/remote-access-agent.git /opt/remote-access-agent
cd /opt/remote-access-agent/Server

# Make scripts executable
chmod +x scripts/*.sh

# Run the automated setup
sudo bash scripts/setup-server.sh
```

The setup script will:
1. Update system packages
2. Install Node.js 20
3. Download and install FRP server
4. Generate authentication credentials
5. Set up the REST API with SQLite database
6. Create and enable systemd services
7. Configure UFW firewall rules

### 3. Save Your Credentials

After setup completes, you'll see output like:

```
FRP Auth Token:     a1b2c3d4e5f6...
FRP Dashboard:      http://localhost:7500
API Server:         http://YOUR_IP:3000
```

**Save the Auth Token** - you need it for each Windows agent installation.

Credentials are also saved to: `/opt/remote-relay/credentials.txt`

### 4. Verify Installation

```bash
# Check FRP server
systemctl status frps

# Check API server
systemctl status relay-api

# Test API health
curl http://localhost:3000/api/health

# Check firewall
sudo ufw status
```

Expected output for health check:
```json
{"status":"ok","timestamp":"2024-01-01T00:00:00.000Z"}
```

## Custom Configuration

### Change FRP Auth Token

```bash
# Edit FRP config
nano /opt/remote-relay/frps.toml

# Change the token value
# token = "your-new-token"

# Restart FRP server
systemctl restart frps
```

### Change API Port

```bash
# Edit the service file
sudo systemctl edit relay-api

# Add/modify:
[Service]
Environment=API_PORT=8080

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart relay-api

# Update firewall
sudo ufw allow 8080/tcp
```

### Change Port Range

Edit `/opt/remote-relay/frps.toml`:

```toml
allowPorts = [
    { start = 40000, end = 41000 }
]
```

Then restart: `systemctl restart frps`

## TLS/SSL Setup (Recommended for Production)

### Option 1: Let's Encrypt with Nginx Reverse Proxy

```bash
# Install Nginx and Certbot
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config for API
cat > /etc/nginx/sites-available/relay-api << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/relay-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get SSL certificate
certbot --nginx -d your-domain.com
```

### Option 2: Self-Signed Certificate

```bash
# Generate self-signed cert
openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout /opt/remote-relay/server.key \
    -out /opt/remote-relay/server.crt \
    -subj "/CN=remote-relay"
```

## Monitoring

### View Real-Time Logs

```bash
# FRP server logs
tail -f /var/log/frps/frps.log

# API server logs
journalctl -u relay-api -f

# Combined view
journalctl -u frps -u relay-api -f
```

### Check Connected Devices

```bash
# Using the management script
/opt/remote-access-agent/Server/scripts/manage-devices.sh list

# Using curl
curl http://localhost:3000/api/devices
```

### FRP Dashboard

The FRP admin dashboard is available at `http://localhost:7500` (only accessible from the server itself).

To access it remotely, use SSH tunneling:

```bash
# From your local machine
ssh -L 7500:localhost:7500 root@YOUR_VPS_IP

# Then open http://localhost:7500 in your browser
```

## Backup

### Database Backup

```bash
# Backup the SQLite database
cp /opt/remote-relay/api/data/relay.db /opt/remote-relay/api/data/relay.db.backup

# Automated daily backup
cat > /etc/cron.daily/relay-backup << 'EOF'
#!/bin/bash
cp /opt/remote-relay/api/data/relay.db "/opt/remote-relay/backups/relay-$(date +%Y%m%d).db"
# Keep only last 30 days
find /opt/remote-relay/backups -name "relay-*.db" -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/relay-backup
mkdir -p /opt/remote-relay/backups
```

## Updating

### Update FRP Server

```bash
# Set new version
FRP_VERSION="0.62.0"

# Download and replace
cd /tmp
wget "https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/frp_${FRP_VERSION}_linux_amd64.tar.gz"
tar -xzf "frp_${FRP_VERSION}_linux_amd64.tar.gz"
systemctl stop frps
cp "frp_${FRP_VERSION}_linux_amd64/frps" /opt/remote-relay/
systemctl start frps
```

### Update API Server

```bash
cd /opt/remote-access-agent
git pull
cp Server/api/server.js /opt/remote-relay/api/
cd /opt/remote-relay/api && npm install --production
systemctl restart relay-api
```

## Troubleshooting

### FRP Server Won't Start

```bash
# Check for port conflicts
ss -tlnp | grep 7000

# Check config syntax
/opt/remote-relay/frps verify -c /opt/remote-relay/frps.toml

# View detailed logs
journalctl -u frps --no-pager -n 50
```

### API Server Won't Start

```bash
# Check Node.js is installed
node --version

# Check for missing dependencies
cd /opt/remote-relay/api && npm install

# Check port conflicts
ss -tlnp | grep 3000
```

### Firewall Issues

```bash
# List all rules
sudo ufw status verbose

# Reset if needed (careful!)
sudo ufw reset

# Re-add rules
sudo ufw allow 22/tcp
sudo ufw allow 7000/tcp
sudo ufw allow 33800:34000/tcp
sudo ufw allow 3000/tcp
sudo ufw enable
```

### Agent Can't Connect

1. Verify VPS ports are open: `nc -zv YOUR_VPS_IP 7000`
2. Check FRP server is running: `systemctl status frps`
3. Verify auth token matches between server and agent
4. Check FRP server logs for connection attempts
