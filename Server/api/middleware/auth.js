const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nrl-remote-x7k9';
const SESSION_INACTIVITY_TIMEOUT = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT_MS) || 30 * 60 * 1000;

// Session activity tracking
const sessionActivity = new Map();

/**
 * Middleware: Require admin JWT token
 * Used for admin-only endpoints (CMS, user management, etc.)
 */
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        // Check session inactivity timeout
        const lastActivity = sessionActivity.get(token);
        if (lastActivity && (Date.now() - lastActivity) > SESSION_INACTIVITY_TIMEOUT) {
            sessionActivity.delete(token);
            return res.status(401).json({ success: false, message: 'Session expired due to inactivity' });
        }
        sessionActivity.set(token, Date.now());
        req.adminUser = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}

/**
 * Middleware: Require any valid JWT token (admin or dashboard user)
 * Used for dashboard endpoints that need authentication but not necessarily admin
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Check session inactivity timeout
        const lastActivity = sessionActivity.get(token);
        if (lastActivity && (Date.now() - lastActivity) > SESSION_INACTIVITY_TIMEOUT) {
            sessionActivity.delete(token);
            return res.status(401).json({ success: false, message: 'Session expired due to inactivity' });
        }
        sessionActivity.set(token, Date.now());
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}

// Clean up expired session activity records every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, lastActivity] of sessionActivity.entries()) {
        if ((now - lastActivity) > SESSION_INACTIVITY_TIMEOUT * 2) sessionActivity.delete(token);
    }
}, 10 * 60 * 1000);

module.exports = { requireAdmin, requireAuth, sessionActivity, JWT_SECRET, SESSION_INACTIVITY_TIMEOUT };
