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

// ============================================================
// CMS Tables
// ============================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS cms_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        image_url TEXT,
        author TEXT DEFAULT 'News Reporter',
        status TEXT DEFAULT 'draft',
        featured INTEGER DEFAULT 0,
        meta_title TEXT,
        meta_description TEXT,
        meta_keywords TEXT,
        source_url TEXT,
        ai_generated INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cms_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#D32F2F',
        sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cms_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS cms_ai_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_url TEXT,
        source_title TEXT,
        status TEXT DEFAULT 'pending',
        rewritten_article_id INTEGER,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cms_rss_feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        category TEXT DEFAULT 'general',
        enabled INTEGER DEFAULT 1,
        last_fetched TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_articles_category ON cms_articles(category);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON cms_articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_slug ON cms_articles(slug);
    CREATE INDEX IF NOT EXISTS idx_articles_published ON cms_articles(published_at);
`);

// Insert default categories if empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM cms_categories').get();
if (catCount.c === 0) {
    const insertCat = db.prepare('INSERT OR IGNORE INTO cms_categories (name, slug, color, sort_order) VALUES (?, ?, ?, ?)');
    const defaultCats = [
        ['Politics', 'politics', '#D32F2F', 1],
        ['Business', 'business', '#2E7D32', 2],
        ['Sports', 'sports', '#1565C0', 3],
        ['Technology', 'technology', '#7B1FA2', 4],
        ['Entertainment', 'entertainment', '#FF6F00', 5],
        ['World', 'world', '#00838F', 6],
        ['Health', 'health', '#C62828', 7],
        ['Science', 'science', '#4527A0', 8],
        ['Opinion', 'opinion', '#546E7A', 9]
    ];
    for (const cat of defaultCats) insertCat.run(...cat);
}

// Insert default settings if empty
const settCount = db.prepare('SELECT COUNT(*) as c FROM cms_settings').get();
if (settCount.c === 0) {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO cms_settings (key, value) VALUES (?, ?)');
    insertSetting.run('site_name', 'News Reporter Live');
    insertSetting.run('site_tagline', 'Live | Trusted | Independent');
    insertSetting.run('site_logo', '');
    insertSetting.run('meta_title', 'News Reporter Live - Latest India News & Breaking Stories');
    insertSetting.run('meta_description', 'Latest India News, Breaking News, Politics, Business, Sports, Technology, Entertainment');
    insertSetting.run('meta_keywords', 'India news, breaking news, politics, business, sports, technology');
    insertSetting.run('admin_password', 'Varma@678');
    insertSetting.run('ai_api_key', '');
    insertSetting.run('ai_provider', 'openai');
    insertSetting.run('ai_model', 'gpt-4o-mini');
    insertSetting.run('ai_auto_publish', '0');
    insertSetting.run('ai_rewrite_prompt', 'Rewrite the following news article in a professional journalistic tone. Keep the facts accurate. Make it engaging and well-structured with multiple paragraphs. Include the word "reportersays" naturally once in the article.');
    insertSetting.run('rss_fetch_interval', '30');
}

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

// Turn off the physical monitor on a remote PC (Privacy Mode for VNC)
// VNC continues working via framebuffer even when monitor is off
app.get('/api/monitor-off', (req, res) => {
    const port = parseInt(req.query.port);
    const user = req.query.user;
    const pass = req.query.pass;
    if (!port) return res.json({ success: false, message: 'Missing port parameter' });
    if (!user || !pass) return res.json({ success: false, message: 'Username and password required to turn off monitor' });
    
    const { exec } = require('child_process');
    
    // Use xfreerdp to connect briefly and run rundll32 to turn off monitor
    // rundll32 user32.dll,LockWorkStation locks the screen; nircmd is used to turn off monitor
    // Simplest approach: use powershell via xfreerdp RemoteApp
    const monitorOffScript = 'powershell -Command "Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;public class MonOff{[DllImport(\\\"user32.dll\\\")]public static extern int SendMessage(int h,int m,int w,int l);}\' -PassThru | Out-Null;[MonOff]::SendMessage(-1,0x0112,0xF170,2)"';
    const rdpCmd = `timeout 15 xfreerdp /v:127.0.0.1:${port} /u:'${user}' /p:'${pass}' /cert:ignore /app:'cmd' /app-cmd:'/c ${monitorOffScript}' /sec:nla 2>&1 || true`;
    
    console.log(`Monitor-off requested for port ${port} user ${user}`);
    exec(rdpCmd, { timeout: 20000 }, (err, stdout, stderr) => {
        console.log(`Monitor-off result: ${stdout || ''} ${stderr || ''}`);
        res.json({ 
            success: true, 
            message: 'Monitor off command sent. The physical display should turn off while VNC continues working.',
            port 
        });
    });
});

// Lock screen on remote PC (legacy endpoint)
app.get('/api/lock-screen', (req, res) => {
    const port = parseInt(req.query.port);
    if (!port) return res.json({ success: false, message: 'Missing port parameter' });
    res.json({ success: true, message: 'Use Privacy Mode to turn off the physical monitor while using Same Screen (VNC).', port });
});

// Set RDP credentials for a connection (temporary, used for NLA auth)
app.post('/api/set-rdp-creds', (req, res) => {
    const { connName, username, password, port } = req.body;
    if (!connName || !username || !password || !port) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    const { execSync } = require('child_process');
    
    try {
        // Read current user-mapping.xml from guacamole container
        const currentXml = execSync('docker exec guacamole cat /etc/guacamole/user-mapping.xml', { encoding: 'utf8' });
        
        // Find the connection and add/update username and password params
        // Look for the connection by name and port
        let updatedXml = currentXml;
        
        // Build regex to find the connection block for this specific RDP connection
        const connRegex = new RegExp(
            `(<connection name="${connName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">[\\s\\S]*?<param name="port">${port}</param>[\\s\\S]*?)(</connection>)`,
            'g'
        );
        
        updatedXml = updatedXml.replace(connRegex, (match, before, closing) => {
            // Remove any existing username/password params
            let cleaned = before.replace(/<param name="username">.*?<\/param>\s*/g, '');
            cleaned = cleaned.replace(/<param name="password">.*?<\/param>\s*/g, '');
            // Don't remove VNC password params (they use just "password" without "username")
            // Add username and password before closing tag
            const indent = '            ';
            return cleaned + `${indent}<param name="username">${username}</param>\n${indent}<param name="password">${password}</param>\n        ${closing}`;
        });
        
        if (updatedXml === currentXml) {
            return res.json({ success: false, message: 'Connection not found: ' + connName });
        }
        
        // Write updated XML back to container
        const fs = require('fs');
        fs.writeFileSync('/tmp/user-mapping-temp.xml', updatedXml);
        execSync('docker cp /tmp/user-mapping-temp.xml guacamole:/etc/guacamole/user-mapping.xml');
        
        // Clear Guacamole auth cache by touching the file (Guacamole re-reads on change)
        execSync('docker exec guacamole touch /etc/guacamole/user-mapping.xml');
        
        console.log(`RDP credentials set for ${connName} port ${port} user ${username}`);
        res.json({ success: true, message: 'Credentials set' });
    } catch (err) {
        console.error('Set RDP creds error:', err.message);
        res.json({ success: false, message: err.message });
    }
});

// Clear RDP credentials after disconnect (security: don't persist)
app.post('/api/clear-rdp-creds', (req, res) => {
    const { connName, port } = req.body;
    if (!connName || !port) {
        return res.json({ success: false, message: 'Missing required fields' });
    }
    
    const { execSync } = require('child_process');
    
    try {
        const currentXml = execSync('docker exec guacamole cat /etc/guacamole/user-mapping.xml', { encoding: 'utf8' });
        
        // Remove username and password params from the specific connection
        const connRegex = new RegExp(
            `(<connection name="${connName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">[\\s\\S]*?<param name="port">${port}</param>[\\s\\S]*?)(</connection>)`,
            'g'
        );
        
        let updatedXml = currentXml.replace(connRegex, (match, before, closing) => {
            let cleaned = before.replace(/\s*<param name="username">.*?<\/param>/g, '');
            cleaned = cleaned.replace(/\s*<param name="password">(?!8096).*?<\/param>/g, '');
            return cleaned + closing;
        });
        
        const fs = require('fs');
        fs.writeFileSync('/tmp/user-mapping-temp.xml', updatedXml);
        execSync('docker cp /tmp/user-mapping-temp.xml guacamole:/etc/guacamole/user-mapping.xml');
        execSync('docker exec guacamole touch /etc/guacamole/user-mapping.xml');
        
        console.log(`RDP credentials cleared for ${connName} port ${port}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Clear RDP creds error:', err.message);
        res.json({ success: false, message: err.message });
    }
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
// CMS API Routes
// ============================================================

// Serve admin panel
app.get('/admin', (req, res) => {
    const adminPath = path.join(DASHBOARD_DIR, 'newssite', 'admin.html');
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.status(404).send('Admin panel not found');
    }
});

// --- Articles CRUD ---
app.get('/api/cms/articles', (req, res) => {
    try {
        const { status, category, limit, offset, search } = req.query;
        let sql = 'SELECT * FROM cms_articles WHERE 1=1';
        const params = [];
        if (status) { sql += ' AND status = ?'; params.push(status); }
        if (category) { sql += ' AND category = ?'; params.push(category); }
        if (search) { sql += ' AND (title LIKE ? OR content LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        sql += ' ORDER BY created_at DESC';
        if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
        if (offset) { sql += ' OFFSET ?'; params.push(parseInt(offset)); }
        const articles = db.prepare(sql).all(...params);
        const total = db.prepare('SELECT COUNT(*) as c FROM cms_articles' + (status ? ' WHERE status = ?' : '')).get(status || undefined);
        res.json({ success: true, articles, total: total ? total.c : articles.length });
    } catch (err) {
        console.error('CMS list articles error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/cms/articles/:id', (req, res) => {
    try {
        const article = db.prepare('SELECT * FROM cms_articles WHERE id = ?').get(req.params.id);
        if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
        res.json({ success: true, article });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

function generateSlug(title) {
    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = db.prepare('SELECT id FROM cms_articles WHERE slug = ?').get(slug);
    if (existing) slug += '-' + Date.now();
    return slug;
}

app.post('/api/cms/articles', (req, res) => {
    try {
        const { title, content, excerpt, category, image_url, author, status, featured, meta_title, meta_description, meta_keywords, source_url, ai_generated } = req.body;
        if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });
        const slug = generateSlug(title);
        const publishedAt = status === 'published' ? new Date().toISOString() : null;
        const result = db.prepare(`
            INSERT INTO cms_articles (title, slug, excerpt, content, category, image_url, author, status, featured, meta_title, meta_description, meta_keywords, source_url, ai_generated, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(title, slug, excerpt || '', content, category || 'general', image_url || '', author || 'News Reporter', status || 'draft', featured ? 1 : 0, meta_title || title, meta_description || excerpt || '', meta_keywords || '', source_url || '', ai_generated ? 1 : 0, publishedAt);
        res.json({ success: true, id: result.lastInsertRowid, slug });
    } catch (err) {
        console.error('CMS create article error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/cms/articles/:id', (req, res) => {
    try {
        const article = db.prepare('SELECT * FROM cms_articles WHERE id = ?').get(req.params.id);
        if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
        const { title, content, excerpt, category, image_url, author, status, featured, meta_title, meta_description, meta_keywords } = req.body;
        const publishedAt = (status === 'published' && !article.published_at) ? new Date().toISOString() : article.published_at;
        db.prepare(`
            UPDATE cms_articles SET title=?, content=?, excerpt=?, category=?, image_url=?, author=?, status=?, featured=?, meta_title=?, meta_description=?, meta_keywords=?, published_at=?, updated_at=datetime('now') WHERE id=?
        `).run(title || article.title, content || article.content, excerpt !== undefined ? excerpt : article.excerpt, category || article.category, image_url !== undefined ? image_url : article.image_url, author || article.author, status || article.status, featured !== undefined ? (featured ? 1 : 0) : article.featured, meta_title || article.meta_title, meta_description !== undefined ? meta_description : article.meta_description, meta_keywords !== undefined ? meta_keywords : article.meta_keywords, publishedAt, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/cms/articles/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM cms_articles WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Categories ---
app.get('/api/cms/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM cms_categories ORDER BY sort_order').all();
        res.json({ success: true, categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/cms/categories', (req, res) => {
    try {
        const { name, color, description } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM cms_categories').get();
        db.prepare('INSERT INTO cms_categories (name, slug, color, description, sort_order) VALUES (?, ?, ?, ?, ?)').run(name, slug, color || '#D32F2F', description || '', (maxOrder.m || 0) + 1);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/cms/categories/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM cms_categories WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Settings ---
app.get('/api/cms/settings', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM cms_settings').all();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/cms/settings', (req, res) => {
    try {
        const updates = req.body;
        const upsert = db.prepare('INSERT OR REPLACE INTO cms_settings (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(updates)) {
            upsert.run(key, String(value));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- RSS Feeds ---
app.get('/api/cms/feeds', (req, res) => {
    try {
        const feeds = db.prepare('SELECT * FROM cms_rss_feeds ORDER BY created_at DESC').all();
        res.json({ success: true, feeds });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/cms/feeds', (req, res) => {
    try {
        const { name, url, category, enabled } = req.body;
        if (!name || !url) return res.status(400).json({ success: false, message: 'Name and URL required' });
        db.prepare('INSERT INTO cms_rss_feeds (name, url, category, enabled) VALUES (?, ?, ?, ?)').run(name, url, category || 'general', enabled !== undefined ? (enabled ? 1 : 0) : 1);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/cms/feeds/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM cms_rss_feeds WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- AI Log ---
app.get('/api/cms/ai-log', (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM cms_ai_log ORDER BY created_at DESC LIMIT 50').all();
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- AI Rewrite single article ---
app.post('/api/cms/ai-rewrite', async (req, res) => {
    try {
        const { title, content, source_url } = req.body;
        if (!content) return res.status(400).json({ success: false, message: 'Content is required' });

        const settings = {};
        db.prepare('SELECT * FROM cms_settings').all().forEach(r => settings[r.key] = r.value);

        const apiKey = settings.ai_api_key;
        if (!apiKey) return res.status(400).json({ success: false, message: 'AI API key not configured. Go to Settings to add one.' });

        const provider = settings.ai_provider || 'openai';
        const model = settings.ai_model || 'gpt-4o-mini';
        const prompt = settings.ai_rewrite_prompt || 'Rewrite this news article professionally.';

        const rewritten = await callAI(provider, apiKey, model, prompt, title, content);
        if (!rewritten) return res.status(500).json({ success: false, message: 'AI rewrite failed' });

        // Log it
        db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status) VALUES (?, ?, ?)').run(source_url || '', title || '', 'success');

        res.json({ success: true, rewritten });
    } catch (err) {
        console.error('AI rewrite error:', err);
        db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status, error_message) VALUES (?, ?, ?, ?)').run(req.body.source_url || '', req.body.title || '', 'error', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Fetch RSS and auto-publish ---
app.post('/api/cms/fetch-rss', async (req, res) => {
    try {
        const feeds = db.prepare('SELECT * FROM cms_rss_feeds WHERE enabled = 1').all();
        if (feeds.length === 0) return res.json({ success: true, message: 'No enabled feeds', fetched: 0 });

        const https = require('https');
        const httpModule = require('http');
        let totalFetched = 0;

        for (const feed of feeds) {
            try {
                const xml = await fetchUrl(feed.url);
                const items = parseRSSItems(xml);
                for (const item of items.slice(0, 5)) {
                    // Check if already exists
                    const exists = db.prepare('SELECT id FROM cms_articles WHERE source_url = ?').get(item.link);
                    if (exists) continue;

                    // Check AI settings
                    const settings = {};
                    db.prepare('SELECT * FROM cms_settings').all().forEach(r => settings[r.key] = r.value);
                    const apiKey = settings.ai_api_key;

                    let articleContent = item.description || item.title;
                    let aiGenerated = 0;

                    if (apiKey && settings.ai_auto_publish === '1') {
                        try {
                            const rewritten = await callAI(settings.ai_provider || 'openai', apiKey, settings.ai_model || 'gpt-4o-mini', settings.ai_rewrite_prompt || 'Rewrite this article.', item.title, item.description || '');
                            if (rewritten && rewritten.content) {
                                articleContent = rewritten.content;
                                aiGenerated = 1;
                            }
                        } catch (aiErr) {
                            console.error('AI rewrite failed for RSS item:', aiErr.message);
                            db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status, error_message) VALUES (?, ?, ?, ?)').run(item.link, item.title, 'error', aiErr.message);
                        }
                    }

                    const slug = generateSlug(item.title);
                    const status = (apiKey && settings.ai_auto_publish === '1') ? 'published' : 'draft';
                    db.prepare(`
                        INSERT INTO cms_articles (title, slug, excerpt, content, category, image_url, author, status, source_url, ai_generated, published_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(item.title, slug, (item.description || '').substring(0, 200), articleContent, feed.category, item.image || '', 'News Reporter AI', status, item.link, aiGenerated, status === 'published' ? new Date().toISOString() : null);

                    db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status) VALUES (?, ?, ?)').run(item.link, item.title, status === 'published' ? 'auto-published' : 'draft-saved');
                    totalFetched++;
                }
                db.prepare('UPDATE cms_rss_feeds SET last_fetched = datetime("now") WHERE id = ?').run(feed.id);
            } catch (feedErr) {
                console.error(`RSS fetch error for ${feed.name}:`, feedErr.message);
            }
        }

        res.json({ success: true, fetched: totalFetched });
    } catch (err) {
        console.error('RSS fetch error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- CMS Stats ---
app.get('/api/cms/stats', (req, res) => {
    try {
        const totalArticles = db.prepare('SELECT COUNT(*) as c FROM cms_articles').get().c;
        const published = db.prepare('SELECT COUNT(*) as c FROM cms_articles WHERE status = ?').get('published').c;
        const drafts = db.prepare('SELECT COUNT(*) as c FROM cms_articles WHERE status = ?').get('draft').c;
        const aiGenerated = db.prepare('SELECT COUNT(*) as c FROM cms_articles WHERE ai_generated = 1').get().c;
        const totalViews = db.prepare('SELECT SUM(views) as v FROM cms_articles').get().v || 0;
        const categories = db.prepare('SELECT COUNT(*) as c FROM cms_categories').get().c;
        const feeds = db.prepare('SELECT COUNT(*) as c FROM cms_rss_feeds WHERE enabled = 1').get().c;
        const recentAiLogs = db.prepare('SELECT * FROM cms_ai_log ORDER BY created_at DESC LIMIT 10').all();
        res.json({ success: true, stats: { totalArticles, published, drafts, aiGenerated, totalViews, categories, feeds, recentAiLogs } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Public news API (for the frontend news site) ---
app.get('/api/news', (req, res) => {
    try {
        const { category, limit, offset } = req.query;
        let sql = 'SELECT id, title, slug, excerpt, image_url, author, category, views, published_at, created_at FROM cms_articles WHERE status = ?';
        const params = ['published'];
        if (category) { sql += ' AND category = ?'; params.push(category); }
        sql += ' ORDER BY published_at DESC';
        sql += ' LIMIT ?';
        params.push(parseInt(limit) || 20);
        if (offset) { sql += ' OFFSET ?'; params.push(parseInt(offset)); }
        const articles = db.prepare(sql).all(...params);
        res.json({ success: true, articles });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/news/:slug', (req, res) => {
    try {
        const article = db.prepare('SELECT * FROM cms_articles WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
        if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
        // Increment views
        db.prepare('UPDATE cms_articles SET views = views + 1 WHERE id = ?').run(article.id);
        res.json({ success: true, article });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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

// AI API call helper
async function callAI(provider, apiKey, model, systemPrompt, title, content) {
    const https = require('https');
    
    let hostname, apiPath, body;
    
    if (provider === 'gemini' || provider === 'google') {
        hostname = 'generativelanguage.googleapis.com';
        apiPath = `/v1beta/models/${model || 'gemini-pro'}:generateContent?key=${apiKey}`;
        body = JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nTitle: ${title}\n\nOriginal Article:\n${content}\n\nProvide your response as JSON: {"title": "rewritten title", "content": "rewritten article HTML with <p> tags", "excerpt": "2-3 sentence summary", "meta_description": "SEO meta description"}` }] }]
        });
    } else {
        // OpenAI compatible (works with OpenAI, Groq, Together, etc)
        hostname = provider === 'groq' ? 'api.groq.com' : provider === 'together' ? 'api.together.xyz' : 'api.openai.com';
        apiPath = provider === 'groq' ? '/openai/v1/chat/completions' : '/v1/chat/completions';
        body = JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Title: ${title}\n\nOriginal Article:\n${content}\n\nProvide your response as JSON: {"title": "rewritten title", "content": "rewritten article HTML with <p> tags", "excerpt": "2-3 sentence summary", "meta_description": "SEO meta description"}` }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });
    }
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname,
            path: apiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(provider !== 'gemini' && provider !== 'google' ? { 'Authorization': `Bearer ${apiKey}` } : {})
            }
        }, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    let text;
                    if (provider === 'gemini' || provider === 'google') {
                        text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    } else {
                        text = parsed.choices?.[0]?.message?.content;
                    }
                    if (!text) return reject(new Error('No response from AI: ' + data.substring(0, 200)));
                    // Try to parse as JSON
                    try {
                        const jsonStart = text.indexOf('{');
                        const jsonEnd = text.lastIndexOf('}') + 1;
                        const result = JSON.parse(text.substring(jsonStart, jsonEnd));
                        resolve(result);
                    } catch {
                        resolve({ title: title, content: text, excerpt: text.substring(0, 200), meta_description: text.substring(0, 160) });
                    }
                } catch (e) {
                    reject(new Error('Failed to parse AI response: ' + e.message));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// Fetch URL helper
function fetchUrl(url) {
    const mod = url.startsWith('https') ? require('https') : require('http');
    return new Promise((resolve, reject) => {
        mod.get(url, { timeout: 10000, headers: { 'User-Agent': 'NewsReporterBot/1.0' } }, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return fetchUrl(response.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Simple RSS parser (no external dependency)
function parseRSSItems(xml) {
    const items = [];
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const getTag = (tag) => {
            const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
            return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
        };
        const title = getTag('title');
        const link = getTag('link') || getTag('guid');
        const description = getTag('description').replace(/<[^>]+>/g, ' ').substring(0, 500);
        // Try to extract image
        let image = '';
        const imgMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"|<enclosure[^>]*url="([^"]+)"|<img[^>]*src="([^"]+)"/i);
        if (imgMatch) image = imgMatch[1] || imgMatch[2] || imgMatch[3];
        if (title) items.push({ title, link, description, image });
    }
    return items;
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

// Auto-fetch RSS feeds periodically
let rssFetchTimer = null;
function startRSSFetchTimer() {
    if (rssFetchTimer) clearInterval(rssFetchTimer);
    const settings = {};
    try {
        db.prepare('SELECT * FROM cms_settings').all().forEach(r => settings[r.key] = r.value);
    } catch(e) {}
    const intervalMinutes = parseInt(settings.rss_fetch_interval) || 30;
    console.log(`RSS auto-fetch interval: ${intervalMinutes} minutes`);
    rssFetchTimer = setInterval(async () => {
        try {
            const feeds = db.prepare('SELECT * FROM cms_rss_feeds WHERE enabled = 1').all();
            if (feeds.length === 0) return;
            console.log(`Auto-fetching ${feeds.length} RSS feeds...`);
            // Trigger the fetch endpoint internally
            const httpModule = require('http');
            httpModule.get(`http://127.0.0.1:${PORT}/api/cms/fetch-rss`, { method: 'POST' });
        } catch (err) {
            console.error('Auto RSS fetch error:', err);
        }
    }, intervalMinutes * 60 * 1000);
}
startRSSFetchTimer();

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
