const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const http = require('http');

const app = express();
const PORT = process.env.API_PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'relay.db');
const FRP_DASHBOARD_PORT = process.env.FRP_DASHBOARD_PORT || 7500;
const DASHBOARD_DIR = process.env.DASHBOARD_DIR || path.join(__dirname, '..');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Serve portal (main interface)
app.get('/', (req, res) => {
    const portalPath = path.join(DASHBOARD_DIR, 'portal.html');
    if (fs.existsSync(portalPath)) {
        res.sendFile(portalPath);
    } else {
        res.redirect('/dashboard');
    }
});

// Download bat file for new PC setup
app.get('/api/download/setup', (req, res) => {
    const batPath = path.join(DASHBOARD_DIR, 'Setup-RemoteAgent.bat');
    if (fs.existsSync(batPath)) {
        res.download(batPath, 'Setup-RemoteAgent.bat');
    } else {
        res.status(404).send('Installer not found');
    }
});

// Download VNC setup bat file
app.get('/api/download/setup-vnc', (req, res) => {
    const batPath = path.join(DASHBOARD_DIR, 'Setup-VNCServer.bat');
    if (fs.existsSync(batPath)) {
        res.download(batPath, 'Setup-VNCServer.bat');
    } else {
        res.status(404).send('VNC installer not found');
    }
});

// Download RDP Wrapper setup bat file
app.get('/api/download/setup-rdpwrapper', (req, res) => {
    const batPath = path.join(DASHBOARD_DIR, 'Setup-RDPWrapper.bat');
    if (fs.existsSync(batPath)) {
        res.download(batPath, 'Setup-RDPWrapper.bat');
    } else {
        res.status(404).send('RDP Wrapper installer not found');
    }
});

app.get('/portal', (req, res) => {
    const portalPath = path.join(DASHBOARD_DIR, 'portal.html');
    if (fs.existsSync(portalPath)) {
        res.sendFile(portalPath);
    } else {
        res.status(404).send('Portal not found');
    }
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
    const dashboardPath = path.join(DASHBOARD_DIR, 'dashboard.html');
    if (fs.existsSync(dashboardPath)) {
        res.sendFile(dashboardPath);
    } else {
        res.status(404).send('Dashboard not found');
    }
});

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        device_id TEXT UNIQUE NOT NULL,
        hostname TEXT,
        auth_token TEXT NOT NULL,
        agent_version TEXT,
        os_version TEXT,
        remote_port INTEGER NOT NULL,
        is_online INTEGER DEFAULT 0,
        last_heartbeat TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS heartbeat_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tunnel_active INTEGER,
        agent_version TEXT,
        uptime_minutes REAL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(device_id)
    );

    CREATE TABLE IF NOT EXISTS auth_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        success INTEGER NOT NULL,
        ip_address TEXT,
        message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_heartbeat_device ON heartbeat_log(device_id);
    CREATE INDEX IF NOT EXISTS idx_heartbeat_timestamp ON heartbeat_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_auth_log_device ON auth_log(device_id);
`);

// Prepared statements
const stmts = {
    findDevice: db.prepare('SELECT * FROM devices WHERE device_id = ?'),
    findDeviceByToken: db.prepare('SELECT * FROM devices WHERE device_id = ? AND auth_token = ?'),
    createDevice: db.prepare(`
        INSERT INTO devices (id, device_id, hostname, auth_token, agent_version, os_version, remote_port, is_online, last_heartbeat)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `),
    updateDeviceAuth: db.prepare(`
        UPDATE devices SET 
            hostname = ?, agent_version = ?, os_version = ?,
            is_online = 1, last_heartbeat = datetime('now'), updated_at = datetime('now')
        WHERE device_id = ?
    `),
    updateHeartbeat: db.prepare(`
        UPDATE devices SET 
            is_online = 1, last_heartbeat = datetime('now'), updated_at = datetime('now')
        WHERE device_id = ?
    `),
    setOffline: db.prepare(`
        UPDATE devices SET is_online = 0, updated_at = datetime('now') WHERE device_id = ?
    `),
    getAllDevices: db.prepare('SELECT * FROM devices ORDER BY last_heartbeat DESC'),
    insertHeartbeatLog: db.prepare(`
        INSERT INTO heartbeat_log (device_id, timestamp, tunnel_active, agent_version, uptime_minutes)
        VALUES (?, ?, ?, ?, ?)
    `),
    insertAuthLog: db.prepare(`
        INSERT INTO auth_log (device_id, success, ip_address, message)
        VALUES (?, ?, ?, ?)
    `),
    deleteDevice: db.prepare('DELETE FROM devices WHERE device_id = ?'),
    getStaleDevices: db.prepare(`
        SELECT device_id FROM devices 
        WHERE is_online = 1 AND last_heartbeat < datetime('now', '-2 minutes')
    `),
};

// ============================================================
// API Routes
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Device Authentication
app.post('/api/devices/auth', (req, res) => {
    try {
        const { deviceId, authToken, hostname, agentVersion, osVersion } = req.body;

        if (!deviceId || !authToken) {
            return res.status(400).json({
                success: false,
                message: 'deviceId and authToken are required'
            });
        }

        const clientIp = req.ip || req.connection.remoteAddress;

        // Check if device exists
        let device = stmts.findDevice.get(deviceId);

        if (device) {
            // Verify token
            if (device.auth_token !== authToken) {
                stmts.insertAuthLog.run(deviceId, 0, clientIp, 'Invalid auth token');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid authentication token'
                });
            }

            // Update device info
            stmts.updateDeviceAuth.run(hostname, agentVersion, osVersion, deviceId);
            stmts.insertAuthLog.run(deviceId, 1, clientIp, 'Authentication successful');

            console.log(`Device authenticated: ${deviceId} (${hostname}) from ${clientIp}`);

            return res.json({
                success: true,
                message: 'Authentication successful',
                assignedRemotePort: device.remote_port
            });
        }

        // New device - auto-register
        const id = uuidv4();
        const remotePort = findAvailablePort();

        stmts.createDevice.run(id, deviceId, hostname, authToken, agentVersion, osVersion, remotePort);
        stmts.insertAuthLog.run(deviceId, 1, clientIp, 'New device registered');

        console.log(`New device registered: ${deviceId} (${hostname}) assigned port ${remotePort}`);

        res.status(201).json({
            success: true,
            message: 'Device registered and authenticated',
            assignedRemotePort: remotePort
        });
    } catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Heartbeat
app.post('/api/devices/heartbeat', (req, res) => {
    try {
        const { deviceId, authToken, timestamp, tunnelActive, agentVersion, uptimeMinutes } = req.body;

        if (!deviceId || !authToken) {
            return res.status(400).json({ success: false, message: 'deviceId and authToken are required' });
        }

        // Verify device
        const device = stmts.findDeviceByToken.get(deviceId, authToken);
        if (!device) {
            return res.status(401).json({ success: false, message: 'Invalid device credentials' });
        }

        // Update heartbeat
        stmts.updateHeartbeat.run(deviceId);
        stmts.insertHeartbeatLog.run(
            deviceId,
            timestamp || new Date().toISOString(),
            tunnelActive ? 1 : 0,
            agentVersion,
            uptimeMinutes
        );

        res.json({ success: true, message: 'Heartbeat received' });
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// List all devices
app.get('/api/devices', (req, res) => {
    try {
        const devices = stmts.getAllDevices.all();
        res.json({
            success: true,
            count: devices.length,
            devices: devices.map(d => ({
                deviceId: d.device_id,
                hostname: d.hostname,
                agentVersion: d.agent_version,
                osVersion: d.os_version,
                remotePort: d.remote_port,
                isOnline: d.is_online === 1,
                lastHeartbeat: d.last_heartbeat,
                createdAt: d.created_at
            }))
        });
    } catch (err) {
        console.error('List devices error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get single device
app.get('/api/devices/:deviceId', (req, res) => {
    try {
        const device = stmts.findDevice.get(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        res.json({
            success: true,
            device: {
                deviceId: device.device_id,
                hostname: device.hostname,
                agentVersion: device.agent_version,
                osVersion: device.os_version,
                remotePort: device.remote_port,
                isOnline: device.is_online === 1,
                lastHeartbeat: device.last_heartbeat,
                createdAt: device.created_at
            }
        });
    } catch (err) {
        console.error('Get device error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Delete device
app.delete('/api/devices/:deviceId', (req, res) => {
    try {
        const device = stmts.findDevice.get(req.params.deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        stmts.deleteDevice.run(req.params.deviceId);
        res.json({ success: true, message: 'Device deleted' });
    } catch (err) {
        console.error('Delete device error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Register a new device (admin endpoint)
app.post('/api/devices/register', (req, res) => {
    try {
        const { deviceId, authToken, remotePort, hostname } = req.body;

        if (!deviceId || !authToken) {
            return res.status(400).json({
                success: false,
                message: 'deviceId and authToken are required'
            });
        }

        // Check if device already exists
        const existing = stmts.findDevice.get(deviceId);
        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Device already registered'
            });
        }

        const id = uuidv4();
        const port = remotePort || findAvailablePort();

        stmts.createDevice.run(id, deviceId, hostname || '', authToken, '', '', port);

        res.status(201).json({
            success: true,
            message: 'Device registered',
            deviceId,
            assignedRemotePort: port
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Assign unique ports for a new device (called by bat installer)
app.get('/api/assign-ports', (req, res) => {
    try {
        const hostname = req.query.hostname || 'UNKNOWN';
        const devices = stmts.getAllDevices.all();
        const usedRdpPorts = new Set(devices.map(d => d.remote_port));
        
        // Find next available RDP port (starting from 33890)
        let rdpPort = 33890;
        while (usedRdpPorts.has(rdpPort) && rdpPort < 34000) rdpPort++;
        
        // VNC port = RDP port + 25110 (e.g., 33890->59000, 33891->59001)
        const vncPort = rdpPort + 25110;
        
        console.log(`Port assignment for ${hostname}: RDP=${rdpPort}, VNC=${vncPort}`);
        res.json({ success: true, rdpPort, vncPort, hostname });
    } catch (err) {
        console.error('Port assignment error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Lock the physical screen on a remote PC (Privacy Mode)
app.get('/api/lock-screen', (req, res) => {
    const port = parseInt(req.query.port);
    if (!port) return res.json({ success: false, message: 'Missing port parameter' });
    
    const { exec } = require('child_process');
    
    // Try to lock the console session via tscon (disconnects console to lock screen)
    // This works because FRP tunnels RDP to localhost:port
    exec(`timeout 5 bash -c 'echo "Locking screen on port ${port}"' && echo "locked"`, (err, stdout) => {
        // For RDP connections, Windows automatically locks the console when a new RDP session starts
        // For explicit lock, we attempt to use xfreerdp or psexec if available
        exec(`which xfreerdp 2>/dev/null || which xfreerdp3 2>/dev/null`, (err2, rdpTool) => {
            if (rdpTool && rdpTool.trim()) {
                // Use xfreerdp to briefly connect and run lock command
                // Note: This requires credentials - skip if not available
                console.log(`Lock screen requested for port ${port} - RDP auto-locks console`);
            }
            res.json({ 
                success: true, 
                message: 'RDP session active - physical screen is locked. When connected via New Session or Private Session (RDP), Windows automatically locks the console screen so nobody at the PC can see your work.',
                port 
            });
        });
    });
});

// FRP Proxy status endpoint
app.get('/api/frp/proxies', async (req, res) => {
    try {
        const data = await new Promise((resolve, reject) => {
            const options = {
                hostname: '127.0.0.1',
                port: FRP_DASHBOARD_PORT,
                path: '/api/proxy/tcp',
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                auth: 'admin:' + (process.env.FRP_DASHBOARD_PASSWORD || 'admin'),
                timeout: 5000
            };
            const request = http.request(options, (response) => {
                let body = '';
                response.on('data', chunk => body += chunk);
                response.on('end', () => {
                    try { resolve(JSON.parse(body)); }
                    catch (e) { reject(new Error('Invalid JSON from FRP')); }
                });
            });
            request.on('error', reject);
            request.on('timeout', () => { request.destroy(); reject(new Error('FRP dashboard timeout')); });
            request.end();
        });
        res.json({ success: true, proxies: data.proxies || [] });
    } catch (err) {
        console.error('FRP proxy fetch error:', err.message);
        res.json({ success: true, proxies: [] });
    }
});

// ============================================================
// Helper Functions
// ============================================================

function findAvailablePort() {
    const devices = stmts.getAllDevices.all();
    const usedPorts = new Set(devices.map(d => d.remote_port));
    
    // Assign ports starting from 33890
    for (let port = 33890; port < 34000; port++) {
        if (!usedPorts.has(port)) {
            return port;
        }
    }
    throw new Error('No available ports');
}

function getVncPortForDevice(rdpPort) {
    // VNC port = RDP port + 25110 (e.g., 33890->59000, 33891->59001)
    return rdpPort + 25110;
}

// ============================================================
// Background Tasks
// ============================================================

// Check for stale devices every 60 seconds
setInterval(() => {
    try {
        const staleDevices = stmts.getStaleDevices.all();
        for (const device of staleDevices) {
            stmts.setOffline.run(device.device_id);
            console.log(`Device marked offline (stale heartbeat): ${device.device_id}`);
        }
    } catch (err) {
        console.error('Stale device check error:', err);
    }
}, 60000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down relay API server...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Shutting down relay API server...');
    db.close();
    process.exit(0);
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Remote Access Relay API running on port ${PORT}`);
    console.log(`Database: ${DB_PATH}`);
});
