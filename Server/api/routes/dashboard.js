/**
 * Dashboard Routes - Server-side authentication, device management, 2FA, user roles
 * Replaces client-side localStorage-only approach with proper server-side security
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || process.env.DASHBOARD_TOKEN_SECRET || 'change-me-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

let db; // Will be set via init()

function init(database) {
    db = database;

    // Create dashboard-specific tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS dashboard_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            display_name TEXT DEFAULT '',
            role TEXT DEFAULT 'admin',
            totp_secret TEXT,
            totp_enabled INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS dashboard_devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            os TEXT DEFAULT 'Windows 11 Pro',
            cpu TEXT DEFAULT 'Unknown',
            ram TEXT DEFAULT 'Unknown',
            status TEXT DEFAULT 'online',
            username TEXT DEFAULT 'user',
            guac_id TEXT,
            mac TEXT DEFAULT '',
            device_group TEXT DEFAULT 'other',
            password TEXT DEFAULT '',
            created_by INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS dashboard_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            user_id INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Seed default admin user if none exists
    const existingUser = db.prepare('SELECT id FROM dashboard_users LIMIT 1').get();
    if (!existingUser) {
        const defaultPassword = process.env.DASHBOARD_ADMIN_PASSWORD || 'changeme';
        const hashedPw = bcrypt.hashSync(defaultPassword, 10);
        db.prepare('INSERT INTO dashboard_users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run(
            'admin', hashedPw, 'Administrator', 'admin'
        );
        console.log('Seeded default dashboard admin user (username: admin). Set DASHBOARD_ADMIN_PASSWORD env var to configure.');
    }
}

// ============================================================
// Dashboard Authentication (server-side)
// ============================================================

// POST /api/dashboard/login - Authenticate dashboard user
router.post('/login', (req, res) => {
    try {
        const { username, password, totpCode } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        const user = db.prepare('SELECT * FROM dashboard_users WHERE username = ?').get(username);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        // Check 2FA if enabled
        if (user.totp_enabled && user.totp_secret) {
            if (!totpCode) {
                return res.status(200).json({ success: false, requires2FA: true, message: 'Two-factor authentication code required' });
            }
            if (!verifyTOTP(user.totp_secret, totpCode)) {
                return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
            }
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, type: 'dashboard' },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                role: user.role,
                totpEnabled: !!user.totp_enabled
            }
        });
    } catch (err) {
        console.error('Dashboard login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// GET /api/dashboard/verify - Verify dashboard token
router.get('/verify', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, username, display_name, role, totp_enabled FROM dashboard_users WHERE id = ?').get(req.user.id);
    if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
    }
    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            role: user.role,
            totpEnabled: !!user.totp_enabled
        }
    });
});

// POST /api/dashboard/change-password - Change dashboard user password
router.post('/change-password', requireAuth, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }
        const user = db.prepare('SELECT * FROM dashboard_users WHERE id = ?').get(req.user.id);
        if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        db.prepare("UPDATE dashboard_users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hashed, req.user.id);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ============================================================
// Two-Factor Authentication (server-side TOTP)
// ============================================================

function generateTOTPSecret() {
    return crypto.randomBytes(20).toString('hex');
}

function getTOTPCode(secret, timeStep) {
    timeStep = timeStep || Math.floor(Date.now() / 30000);
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(0, 0);
    buffer.writeUInt32BE(timeStep, 4);
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
    hmac.update(buffer);
    const hash = hmac.digest();
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24 | (hash[offset + 1] & 0xff) << 16 | (hash[offset + 2] & 0xff) << 8 | (hash[offset + 3] & 0xff)) % 1000000;
    return code.toString().padStart(6, '0');
}

function verifyTOTP(secret, token) {
    const timeStep = Math.floor(Date.now() / 30000);
    for (let i = -1; i <= 1; i++) {
        if (getTOTPCode(secret, timeStep + i) === token) return true;
    }
    return false;
}

// POST /api/dashboard/2fa/setup - Generate 2FA secret
router.post('/2fa/setup', requireAuth, (req, res) => {
    try {
        const secret = generateTOTPSecret();
        db.prepare("UPDATE dashboard_users SET totp_secret = ?, updated_at = datetime('now') WHERE id = ?").run(secret, req.user.id);
        const user = db.prepare('SELECT username FROM dashboard_users WHERE id = ?').get(req.user.id);
        const otpauthUrl = 'otpauth://totp/RemoteAccess:' + (user ? user.username : 'user') + '?secret=' + secret + '&issuer=RemoteAccess&algorithm=SHA1&digits=6&period=30';
        res.json({ success: true, secret, otpauthUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/dashboard/2fa/verify - Verify and enable 2FA
router.post('/2fa/verify', requireAuth, (req, res) => {
    try {
        const { code } = req.body;
        const user = db.prepare('SELECT totp_secret FROM dashboard_users WHERE id = ?').get(req.user.id);
        if (!user || !user.totp_secret) {
            return res.status(400).json({ success: false, message: 'No 2FA secret configured. Call setup first.' });
        }
        if (!code || !verifyTOTP(user.totp_secret, code)) {
            return res.status(400).json({ success: false, message: 'Invalid 2FA code' });
        }
        db.prepare("UPDATE dashboard_users SET totp_enabled = 1, updated_at = datetime('now') WHERE id = ?").run(req.user.id);
        res.json({ success: true, message: '2FA enabled successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/dashboard/2fa/disable - Disable 2FA
router.post('/2fa/disable', requireAuth, (req, res) => {
    try {
        db.prepare("UPDATE dashboard_users SET totp_enabled = 0, totp_secret = NULL, updated_at = datetime('now') WHERE id = ?").run(req.user.id);
        res.json({ success: true, message: '2FA disabled' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Server-side User Roles Management
// ============================================================

// GET /api/dashboard/users - List dashboard users
router.get('/users', requireAuth, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        const users = db.prepare('SELECT id, username, display_name, role, totp_enabled, created_at FROM dashboard_users ORDER BY created_at').all();
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/dashboard/users - Create dashboard user
router.post('/users', requireAuth, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        const { username, password, displayName, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }
        const existing = db.prepare('SELECT id FROM dashboard_users WHERE username = ?').get(username);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already exists' });
        }
        const hashed = bcrypt.hashSync(password, 10);
        const validRole = ['admin', 'viewer'].includes(role) ? role : 'viewer';
        const result = db.prepare('INSERT INTO dashboard_users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run(
            username, hashed, displayName || username, validRole
        );
        res.json({ success: true, id: result.lastInsertRowid, message: 'User created' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/dashboard/users/:id - Update dashboard user role
router.put('/users/:id', requireAuth, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        const { role, displayName } = req.body;
        const user = db.prepare('SELECT * FROM dashboard_users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const validRole = ['admin', 'viewer'].includes(role) ? role : user.role;
        db.prepare("UPDATE dashboard_users SET role = ?, display_name = ?, updated_at = datetime('now') WHERE id = ?").run(
            validRole, displayName || user.display_name, req.params.id
        );
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/dashboard/users/:id - Delete dashboard user
router.delete('/users/:id', requireAuth, (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        // Prevent deleting self
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }
        db.prepare('DELETE FROM dashboard_users WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Server-side Device Management
// ============================================================

// GET /api/dashboard/devices - List all dashboard devices
router.get('/devices', requireAuth, (req, res) => {
    try {
        const devices = db.prepare('SELECT * FROM dashboard_devices ORDER BY created_at DESC').all();
        res.json({ success: true, devices });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/dashboard/devices - Add a device
router.post('/devices', requireAuth, (req, res) => {
    try {
        const { id, name, host, os, cpu, ram, username, guacId, mac, group, password } = req.body;
        if (!name || !host) {
            return res.status(400).json({ success: false, message: 'Name and host are required' });
        }
        const deviceId = id || ('dev-' + Date.now());
        const hashedPw = password ? bcrypt.hashSync(password, 10) : '';
        db.prepare(`INSERT OR REPLACE INTO dashboard_devices (id, name, host, os, cpu, ram, username, guac_id, mac, device_group, password, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
            deviceId, name, host,
            os || 'Windows 11 Pro', cpu || 'Unknown', ram || 'Unknown',
            username || 'user', guacId || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            mac || '', group || 'other', hashedPw, req.user.id
        );
        res.json({ success: true, id: deviceId, message: 'Device added' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/dashboard/devices/:id - Remove a device
router.delete('/devices/:id', requireAuth, (req, res) => {
    try {
        db.prepare('DELETE FROM dashboard_devices WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'Device removed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/dashboard/devices/:id - Update a device
router.put('/devices/:id', requireAuth, (req, res) => {
    try {
        const { name, host, os, cpu, ram, username, guacId, mac, group, status } = req.body;
        const device = db.prepare('SELECT * FROM dashboard_devices WHERE id = ?').get(req.params.id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        db.prepare(`UPDATE dashboard_devices SET
            name = ?, host = ?, os = ?, cpu = ?, ram = ?, username = ?,
            guac_id = ?, mac = ?, device_group = ?, status = ?, updated_at = datetime('now')
            WHERE id = ?`).run(
            name || device.name, host || device.host, os || device.os,
            cpu || device.cpu, ram || device.ram, username || device.username,
            guacId || device.guac_id, mac || device.mac, group || device.device_group,
            status || device.status, req.params.id
        );
        res.json({ success: true, message: 'Device updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Connection Profiles (server-side)
// ============================================================

// GET /api/dashboard/profiles - List connection profiles
router.get('/profiles', requireAuth, (req, res) => {
    try {
        const profiles = db.prepare('SELECT id, name, username, color, created_at FROM dashboard_profiles WHERE user_id = ?').all(req.user.id);
        res.json({ success: true, profiles });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/dashboard/profiles - Create a connection profile
router.post('/profiles', requireAuth, (req, res) => {
    try {
        const { name, username, password, color } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username, and password are required' });
        }
        const encryptedPw = bcrypt.hashSync(password, 10);
        const result = db.prepare('INSERT INTO dashboard_profiles (name, username, password, color, user_id) VALUES (?, ?, ?, ?, ?)').run(
            name, username, encryptedPw, color || '#6366f1', req.user.id
        );
        res.json({ success: true, id: result.lastInsertRowid, message: 'Profile created' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/dashboard/profiles/:id - Delete a connection profile
router.delete('/profiles/:id', requireAuth, (req, res) => {
    try {
        db.prepare('DELETE FROM dashboard_profiles WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ success: true, message: 'Profile deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Audit Log (server-side persistence)
// ============================================================

// POST /api/dashboard/log - Record an audit log entry
router.post('/log', requireAuth, (req, res) => {
    try {
        const { action, details } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const ua = req.headers['user-agent'] || '';
        db.prepare('INSERT INTO audit_log (action, details, ip_address, user_agent) VALUES (?, ?, ?, ?)').run(
            action || 'unknown', details || '', ip, ua
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/dashboard/log - Get recent audit log entries
router.get('/log', requireAuth, (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const logs = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = { router, init };
