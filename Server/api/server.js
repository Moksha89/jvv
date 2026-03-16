const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const cron = require('node-cron');
const crypto = require('crypto');

const http = require('http');

// Category-specific author profiles for SEO
const CATEGORY_AUTHORS = {
    'Politics': { name: 'Rajesh Kumar Sharma', title: 'Senior Political Correspondent', url: 'https://newsreporter.live/team#rajesh-sharma' },
    'Business': { name: 'Priya Mehta', title: 'Business & Economy Editor', url: 'https://newsreporter.live/team#priya-mehta' },
    'Sports': { name: 'Vikram Singh Rathore', title: 'Sports Editor', url: 'https://newsreporter.live/team#vikram-rathore' },
    'Technology': { name: 'Ananya Desai', title: 'Technology Correspondent', url: 'https://newsreporter.live/team#ananya-desai' },
    'Entertainment': { name: 'Kavitha Nair', title: 'Entertainment & Culture Editor', url: 'https://newsreporter.live/team#kavitha-nair' },
    'World': { name: 'Arjun Kapoor', title: 'International Affairs Correspondent', url: 'https://newsreporter.live/team#arjun-kapoor' },
    'Health': { name: 'Dr. Sneha Reddy', title: 'Health & Wellness Editor', url: 'https://newsreporter.live/team#sneha-reddy' },
    'Science': { name: 'Rohan Iyer', title: 'Science & Space Correspondent', url: 'https://newsreporter.live/team#rohan-iyer' },
    'Opinion': { name: 'Meera Joshi', title: 'Senior Opinion Editor', url: 'https://newsreporter.live/team#meera-joshi' },
    'War': { name: 'Col. Deepak Verma (Retd.)', title: 'Defence & Security Analyst', url: 'https://newsreporter.live/team#deepak-verma' },
    'Education': { name: 'Sunita Patel', title: 'Education Correspondent', url: 'https://newsreporter.live/team#sunita-patel' },
    'Jobs': { name: 'Amit Choudhary', title: 'Careers & Employment Editor', url: 'https://newsreporter.live/team#amit-choudhary' },
    'Cricket': { name: 'Vikram Singh Rathore', title: 'Cricket Correspondent', url: 'https://newsreporter.live/team#vikram-rathore' },
    'IPL': { name: 'Siddharth Malhotra', title: 'IPL & T20 Specialist', url: 'https://newsreporter.live/team#siddharth-malhotra' },
    'Gadget Reviews': { name: 'Ananya Desai', title: 'Tech & Gadgets Reviewer', url: 'https://newsreporter.live/team#ananya-desai' }
};

function getAuthorForCategory(category) {
    return CATEGORY_AUTHORS[category] || { name: 'News Reporter Live', title: 'Reporter', url: 'https://newsreporter.live/team' };
}

// JWT expiry
const JWT_EXPIRY = '24h';
const SESSION_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity timeout

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

// Middleware - Enhanced security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting - general API
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    message: { success: false, message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', generalLimiter);

// Rate limiting - login endpoints (strict)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 min
    message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

// Rate limiting - public write endpoints (comments, newsletter, views)
const publicWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per 15 min per IP
    message: { success: false, message: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// XSS sanitization - strip HTML tags and dangerous content
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/?(script|iframe|object|embed|form|input|button|link|meta|style|svg|math)[^>]*>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*\S+/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/data\s*:\s*text\/html/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/vbscript\s*:/gi, '')
        .trim();
}

// IP-based login lockout tracking
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkLoginLockout(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const record = loginAttempts.get(ip);
    if (record && record.lockedUntil && Date.now() < record.lockedUntil) {
        const remainingMs = record.lockedUntil - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return res.status(429).json({ success: false, message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).` });
    }
    next();
}

function recordLoginAttempt(ip, success) {
    if (success) {
        loginAttempts.delete(ip);
        return;
    }
    const record = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
    record.count++;
    if (record.count >= MAX_LOGIN_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_DURATION;
        record.count = 0;
    }
    loginAttempts.set(ip, record);
}

// Clean up old lockout records every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of loginAttempts.entries()) {
        if (record.lockedUntil && now > record.lockedUntil) loginAttempts.delete(ip);
    }
}, 30 * 60 * 1000);

// Image upload configuration
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex') + ext);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
        if (allowed.test(file.originalname)) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// Serve uploaded images
app.use('/uploads', express.static(uploadDir));

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

// Download uninstaller bat file
app.get('/api/download/uninstall', (req, res) => {
    const batPath = path.join(DASHBOARD_DIR, 'Uninstall-RemoteAgent.bat');
    if (fs.existsSync(batPath)) {
        res.download(batPath, 'Uninstall-RemoteAgent.bat');
    } else {
        res.status(404).send('Uninstaller not found');
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

// ============================================================
// Portal Users & Device Assignments Tables
// ============================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS portal_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS device_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        assigned_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES portal_users(id) ON DELETE CASCADE,
        UNIQUE(user_id, device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_device_assignments_user ON device_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_device_assignments_device ON device_assignments(device_id);
`);

// ============================================================
// New Feature Tables: Audit Log, Comments, Newsletter, Connection Logs, Scheduled Publishing, TOTP
// ============================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (article_id) REFERENCES cms_articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        subscribed_at TEXT DEFAULT (datetime('now')),
        unsubscribed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS connection_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        device_id TEXT NOT NULL,
        connection_type TEXT DEFAULT 'rdp',
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        duration_seconds INTEGER DEFAULT 0,
        ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS article_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        viewed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (article_id) REFERENCES cms_articles(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
    CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
    CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
    CREATE INDEX IF NOT EXISTS idx_connection_logs_user ON connection_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_connection_logs_device ON connection_logs(device_id);
    CREATE INDEX IF NOT EXISTS idx_article_views_article ON article_views(article_id);
    CREATE INDEX IF NOT EXISTS idx_article_views_date ON article_views(viewed_at);
`);

// Add scheduled_at column to articles if not exists
try {
    db.exec("ALTER TABLE cms_articles ADD COLUMN scheduled_at TEXT");
} catch (e) { /* column already exists */ }

// Add totp_secret column to portal_users if not exists
try {
    db.exec("ALTER TABLE portal_users ADD COLUMN totp_secret TEXT");
} catch (e) { /* column already exists */ }

// Add totp_enabled column to portal_users if not exists
try {
    db.exec("ALTER TABLE portal_users ADD COLUMN totp_enabled INTEGER DEFAULT 0");
} catch (e) { /* column already exists */ }

// ============================================================
// Persistent JWT Secret (stored in DB, survives restarts)
// ============================================================
let JWT_SECRET;
(function initJWTSecret() {
    const row = db.prepare("SELECT value FROM cms_settings WHERE key = 'jwt_secret'").get();
    if (row && row.value) {
        JWT_SECRET = row.value;
        console.log('Loaded persistent JWT secret from database');
    } else {
        JWT_SECRET = crypto.randomBytes(64).toString('hex');
        db.prepare("INSERT OR REPLACE INTO cms_settings (key, value) VALUES ('jwt_secret', ?)").run(JWT_SECRET);
        console.log('Generated and stored new persistent JWT secret');
    }
})();

// Seed default admin portal user if table is empty
const portalUserCount = db.prepare('SELECT COUNT(*) as c FROM portal_users').get();
if (portalUserCount.c === 0) {
    db.prepare('INSERT INTO portal_users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run('admin', bcrypt.hashSync('admin', 10), 'Administrator', 'admin');
    console.log('Seeded default portal admin user (admin/admin)');
}

// Migrate plaintext admin password to bcrypt if needed
(function migrateAdminPassword() {
    try {
        const row = db.prepare("SELECT value FROM cms_settings WHERE key = 'admin_password'").get();
        if (row && row.value && !row.value.startsWith('$2a$') && !row.value.startsWith('$2b$')) {
            const hashed = bcrypt.hashSync(row.value, 10);
            db.prepare("UPDATE cms_settings SET value = ? WHERE key = 'admin_password'").run(hashed);
            console.log('Migrated admin password from plaintext to bcrypt');
        }
    } catch (e) { console.error('Password migration error:', e.message); }
})();

// Migrate plaintext portal user passwords to bcrypt if needed
(function migratePortalPasswords() {
    try {
        const users = db.prepare('SELECT id, password FROM portal_users').all();
        for (const u of users) {
            if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
                const hashed = bcrypt.hashSync(u.password, 10);
                db.prepare('UPDATE portal_users SET password = ? WHERE id = ?').run(hashed, u.id);
                console.log(`Migrated portal user ${u.id} password to bcrypt`);
            }
        }
    } catch (e) { console.error('Portal password migration error:', e.message); }
})();

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
    insertSetting.run('admin_password', bcrypt.hashSync('Varma@678', 10));
    insertSetting.run('ai_api_key', '');
    insertSetting.run('ai_provider', 'openrouter');
    insertSetting.run('ai_model', 'google/gemini-2.0-flash-001');
    insertSetting.run('ai_auto_publish', '0');
    insertSetting.run('ai_rewrite_prompt', 'You are a senior Indian news reporter writing for News Reporter Live. Rewrite this article in a natural, engaging journalistic tone as if you are a real reporter on the ground. Use vivid language, quotes from sources, and proper news structure (inverted pyramid). Ensure HIGH SEO optimization: use relevant keywords naturally in the first paragraph, include semantic variations, and write compelling subheadings. The article must be 500-800 words, split into multiple paragraphs with <p> tags. Include the word "reportersays" naturally once somewhere in the middle of the article. Make it feel authentic and human-written, NOT robotic or AI-generated.');
    insertSetting.run('rss_fetch_interval', '30');
    insertSetting.run('google_verification', '');
    insertSetting.run('robots_txt', '');
}

// Seed sample articles if CMS is empty
const artCount = db.prepare('SELECT COUNT(*) as c FROM cms_articles').get();
if (artCount.c === 0) {
    console.log('Seeding sample articles into CMS...');
    const seedArticles = [
        { title: 'Parliament Passes Landmark Digital India Infrastructure Bill Amid Opposition Walkout', excerpt: 'The bill aims to establish a comprehensive framework for digital governance and data protection across all states and union territories.', content: '<p>In a landmark session that lasted over 14 hours, the Indian Parliament today passed the Digital India Infrastructure Bill 2026, a comprehensive legislation aimed at transforming the country\'s digital governance framework.</p><p>The new legislation establishes a unified framework for digital identity verification, data protection standards, and cybersecurity protocols. Experts believe this will position India as a global leader in digital governance, according to what reportersays in the latest analysis.</p><p>Industry bodies have largely welcomed the bill, noting that it provides much-needed clarity on data localization requirements.</p>', category: 'politics', image_url: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80', author: 'Priya Sharma', featured: 1 },
        { title: 'Supreme Court Delivers Historic Ruling on Right to Privacy in Digital Age', excerpt: 'A nine-judge bench unanimously upholds expanded privacy protections for citizens in the era of AI and surveillance technology.', content: '<p>The Supreme Court of India today delivered a historic ruling that significantly expands the scope of privacy rights in the digital age.</p><p>Chief Justice delivered the majority opinion, stating that the right to privacy must evolve with technological advancements. As reportersays, this verdict will have far-reaching implications for how technology companies operate in India.</p><p>The judgment mandates that any deployment of AI-based surveillance systems by government agencies must be authorized by a judicial warrant.</p>', category: 'politics', image_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=80', author: 'Rahul Verma', featured: 0 },
        { title: 'State Elections: Exit Polls Predict Major Shift in Political Landscape Across Five States', excerpt: 'Early projections suggest surprising results in Madhya Pradesh, Rajasthan, and three other states going to polls this month.', content: '<p>Exit polls released today after the conclusion of voting in five Indian states have predicted a potential reshuffling of the political landscape.</p><p>In Madhya Pradesh, early projections suggest a closely contested race. As political analysts and what reportersays in their assessment, the results could reshape coalition dynamics.</p><p>Voter turnout was notably higher this time, with several constituencies reporting over 75% participation.</p>', category: 'politics', image_url: 'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80', author: 'Anjali Nair', featured: 0 },
        { title: 'Sensex Surges Past 95,000 Mark as Foreign Investors Pour $4.2 Billion Into Indian Markets', excerpt: 'Record FII inflows drive Indian stock markets to unprecedented highs with banking and IT sectors leading the rally.', content: '<p>The BSE Sensex today breached the historic 95,000 mark for the first time, powered by massive foreign institutional investor inflows totaling $4.2 billion.</p><p>Banking stocks led the rally with HDFC Bank, ICICI Bank, and State Bank of India all hitting 52-week highs. As reportersays in their market analysis, GDP growth is projected at 7.2% for the current fiscal year.</p><p>Analysts attribute the sustained FII interest to India\'s robust economic growth and favorable government policies.</p>', category: 'business', image_url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80', author: 'Vikram Mehta', featured: 1 },
        { title: 'RBI Maintains Repo Rate at 6.25%, Signals Focus on Growth Over Inflation', excerpt: 'The central bank keeps rates unchanged for the fourth consecutive meeting while upgrading GDP growth forecast to 7.2%.', content: '<p>The Reserve Bank of India\'s Monetary Policy Committee today decided to maintain the repo rate at 6.25%, in line with market expectations.</p><p>RBI Governor highlighted that inflation has remained within the 2-6% target range. According to what reportersays, this policy stance positions India favorably compared to other emerging markets.</p><p>The banking sector responded positively to the announcement.</p>', category: 'business', image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', author: 'Deepak Gupta', featured: 0 },
        { title: 'Reliance Industries Announces $15 Billion Investment in Green Hydrogen', excerpt: 'India\'s largest conglomerate bets big on clean energy with plans to build the world\'s largest green hydrogen facility in Gujarat.', content: '<p>Reliance Industries Limited today announced plans to invest $15 billion over the next five years in green hydrogen production.</p><p>The project is expected to create over 100,000 jobs. As reportersays in the energy sector analysis, this investment could accelerate India\'s transition to clean energy.</p><p>The announcement comes amid growing global demand for green hydrogen as countries seek to decarbonize their industrial sectors.</p>', category: 'business', image_url: 'https://images.unsplash.com/photo-1553729459-uj8gfc0d5d16?w=800&q=80', author: 'Meera Iyer', featured: 0 },
        { title: 'India Clinches Test Series Against Australia 3-1, Retains Border-Gavaskar Trophy', excerpt: 'A dominant performance by the Indian cricket team seals a historic series victory on Australian soil with record-breaking innings.', content: '<p>Team India has scripted history by clinching the Test series against Australia 3-1, retaining the coveted Border-Gavaskar Trophy.</p><p>The series victory marks India\'s third consecutive series win in Australia. As cricket experts and what reportersays in their post-match analysis, this team may well be the greatest Indian Test side to have ever toured Australia.</p><p>The BCCI has announced cash awards of INR 5 crore for each player.</p>', category: 'sports', image_url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80', author: 'Suresh Kumar', featured: 1 },
        { title: 'IPL 2026 Auction: Record-Breaking Bids as New Franchises Enter the League', excerpt: 'The mega auction sees unprecedented spending with the most expensive player ever sold going for INR 32 crore.', content: '<p>The IPL 2026 mega auction in Kochi witnessed record-breaking bids as the expanded 12-team league saw franchises spend a combined INR 1,200 crore.</p><p>The two new franchises were the most aggressive buyers. As reportersays in the sports section, this auction signals the continued commercial growth of the IPL.</p><p>Notable overseas signings included top international stars from England, Australia, and South Africa.</p>', category: 'sports', image_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80', author: 'Karthik Rajan', featured: 0 },
        { title: 'Indian Women\'s Hockey Team Qualifies for 2028 Los Angeles Olympics', excerpt: 'A stunning 4-2 victory over Japan in the qualifier final secures India\'s berth at the next Summer Olympics.', content: '<p>The Indian women\'s hockey team has qualified for the 2028 Los Angeles Olympics with a convincing 4-2 victory over Japan.</p><p>This qualification marks the third consecutive Olympics for the team. As what reportersays in the sports commentary, the team\'s journey from obscurity to Olympic qualification is one of the most inspiring stories in Indian sports history.</p><p>The players were received with a hero\'s welcome at the airport.</p>', category: 'sports', image_url: 'https://images.unsplash.com/photo-1461896836934-bd45ba8b2990?w=800&q=80', author: 'Neha Joshi', featured: 0 },
        { title: 'ISRO Successfully Launches Chandrayaan-4 with Advanced AI-Powered Rover', excerpt: 'India\'s ambitious lunar mission carries the most sophisticated rover ever designed by ISRO.', content: '<p>ISRO today successfully launched Chandrayaan-4, India\'s most ambitious lunar mission to date, from the Satish Dhawan Space Centre in Sriharikota.</p><p>Chandrayaan-4 carries an advanced AI-powered rover named Pragyan-2. As reportersays in the science desk coverage, this mission could provide groundbreaking data about lunar water resources.</p><p>The mission is expected to reach lunar orbit in approximately 40 days.</p>', category: 'technology', image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80', author: 'Arjun Reddy', featured: 1 },
        { title: 'Bangalore Startup Develops Revolutionary AI Chip That Rivals Global Giants', excerpt: 'Indigenous semiconductor company raises $500 million in Series C to scale production of its neural processing unit.', content: '<p>A Bangalore-based semiconductor startup has developed an AI chip that rivals products from major global chip makers.</p><p>The startup has raised $500 million in a Series C funding round. As reportersays in the technology analysis, this development could mark a turning point for India\'s semiconductor ambitions.</p><p>The chip has already attracted interest from several Indian IT services companies.</p>', category: 'technology', image_url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80', author: 'Siddharth Rao', featured: 0 },
        { title: 'India Rolls Out World\'s Largest Rural 5G Network Covering 200,000 Villages', excerpt: 'The government-backed initiative aims to bridge the digital divide with high-speed internet access across rural India.', content: '<p>India has completed the deployment of the world\'s largest rural 5G network, covering over 200,000 villages across 28 states.</p><p>Average speeds of 100 Mbps have been recorded. According to what reportersays in the digital India coverage, this rollout is expected to catalyze economic growth in rural areas.</p><p>The government has also launched a digital literacy program alongside the network deployment.</p>', category: 'technology', image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80', author: 'Kavitha Menon', featured: 0 },
        { title: 'Indian Film Wins Palme d\'Or at Cannes: A First for Bollywood in 30 Years', excerpt: 'The critically acclaimed drama about rural India\'s digital transformation receives a standing ovation.', content: '<p>An Indian film has won the prestigious Palme d\'Or at the Cannes Film Festival, the first Bollywood production to receive the top honor in over three decades.</p><p>The director dedicated it to the millions of ordinary Indians whose stories deserve to be told. As reportersays in the entertainment section, this win could spark a new wave of Indian cinema.</p><p>The film is expected to release in Indian theaters next month.</p>', category: 'entertainment', image_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80', author: 'Aisha Khan', featured: 0 },
        { title: 'AR Rahman\'s New Album Breaks All Streaming Records in India', excerpt: 'The legendary composer\'s latest work garners 100 million streams in just 48 hours across all major platforms.', content: '<p>Oscar-winning composer AR Rahman\'s latest album has shattered all previous streaming records in India, garnering over 100 million streams within 48 hours.</p><p>The album features collaborations with artists from 12 different countries. As what reportersays in the cultural review, the album represents a new frontier in music where AI and human creativity coexist.</p><p>Rahman will embark on a world tour starting next month.</p>', category: 'entertainment', image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', author: 'Ritu Desai', featured: 0 },
        { title: 'G20 Summit in New Delhi Produces Historic Climate Agreement', excerpt: 'World leaders agree to triple renewable energy capacity by 2030 and establish a $100 billion green transition fund.', content: '<p>The G20 Summit hosted in New Delhi has produced a historic climate agreement that commits all member nations to tripling their renewable energy capacity by 2030.</p><p>India played a pivotal role in brokering the agreement. As reportersays in the international affairs analysis, India\'s diplomatic leadership has significantly elevated its standing on the global stage.</p><p>Environmental groups have cautiously welcomed the agreement.</p>', category: 'world', image_url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80', author: 'Rajesh Khanna', featured: 0 },
        { title: 'AIIMS Develops Breakthrough Treatment for Drug-Resistant Tuberculosis', excerpt: 'The new therapy shows 94% success rate in clinical trials, offering hope to millions of TB patients worldwide.', content: '<p>Researchers at AIIMS have developed a breakthrough treatment for drug-resistant tuberculosis with a 94% success rate in Phase III clinical trials.</p><p>India accounts for approximately 27% of the world\'s TB cases. As what reportersays in the health section, this could be the most significant advancement in TB treatment in four decades.</p><p>The treatment has received fast-track approval from the Drug Controller General of India.</p>', category: 'health', image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80', author: 'Dr. Pooja Singh', featured: 0 },
        { title: 'IIT Researchers Create World\'s Most Efficient Solar Cell Using Perovskite', excerpt: 'The new solar cell achieves 33.7% efficiency, breaking all previous records.', content: '<p>A team at IIT Bombay has created the world\'s most efficient perovskite solar cell, achieving a record-breaking 33.7% efficiency.</p><p>The cells can be manufactured at one-tenth the cost of silicon solar cells. As reportersays in the science coverage, this development could democratize solar energy globally.</p><p>The team has filed for international patents and is in discussions with manufacturers.</p>', category: 'science', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80', author: 'Prof. Amit Patel', featured: 0 },
        { title: 'Government Unveils Ambitious Urban Transport Plan for 50 Cities', excerpt: 'A INR 3 lakh crore initiative promises metro connectivity, electric buses, and smart traffic management.', content: '<p>The Union Government today unveiled an urban transport overhaul plan worth INR 3 lakh crore for 50 Indian cities over the next decade.</p><p>Under the plan, all 50 cities will receive fully electric public bus fleets by 2030. As reportersays in the urban development analysis, this plan could fundamentally transform how Indians commute.</p><p>The funding will come from central government grants, state contributions, and PPP.</p>', category: 'politics', image_url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&q=80', author: 'Manish Tiwari', featured: 0 },
        { title: 'India Becomes World\'s Third Largest Economy, Overtakes Japan', excerpt: 'GDP figures confirm India\'s rise as the third largest economy with a GDP of $4.5 trillion.', content: '<p>India has officially become the world\'s third-largest economy, overtaking Japan in nominal GDP terms with a GDP of $4.5 trillion.</p><p>The milestone was achieved on sustained high growth rates averaging 7%. As what reportersays in the economic analysis, this achievement validates India\'s reform agenda.</p><p>The government has set a target of becoming a $10 trillion economy by 2035.</p>', category: 'business', image_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&q=80', author: 'Alok Sharma', featured: 0 },
        { title: 'India\'s Gaming Industry Valued at $8 Billion, Set to Triple by 2030', excerpt: 'Mobile gaming leads the charge as India becomes the world\'s largest gaming market by user base.', content: '<p>India\'s gaming industry has reached a valuation of $8 billion with over 600 million gamers, the world\'s largest gaming user base.</p><p>Mobile gaming accounts for approximately 85% of the market. As reportersays in the technology and entertainment coverage, India\'s gaming ecosystem is creating thousands of high-skilled jobs.</p><p>The government has recognized gaming as a sunrise industry under the AVGC task force.</p>', category: 'entertainment', image_url: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&q=80', author: 'Vishal Jain', featured: 0 },
        { title: 'India Launches Universal Mental Health Coverage Under Ayushman Bharat', excerpt: 'The expanded healthcare scheme will provide free mental health services to 500 million beneficiaries.', content: '<p>The government announced the inclusion of comprehensive mental health coverage for all 500 million Ayushman Bharat beneficiaries.</p><p>Under the expanded scheme, beneficiaries will have access to counseling, psychiatric consultations, and medication at no cost. As reportersays in the health policy analysis, this initiative could transform India\'s approach to mental health.</p><p>Mental health experts have welcomed the initiative.</p>', category: 'health', image_url: 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80', author: 'Dr. Sneha Agarwal', featured: 0 },
        { title: 'Neeraj Chopra Sets New World Record in Javelin at Diamond League', excerpt: 'Olympic gold medalist throws 93.47 meters, shattering the previous world record.', content: '<p>Olympic champion Neeraj Chopra has set a new world record in the javelin throw at the Diamond League meeting in Zurich with a throw of 93.47 meters.</p><p>The historic throw came in his fourth attempt. As reportersays in the sports analysis, Chopra\'s world record cements his status as one of the greatest javelin throwers of all time.</p><p>The Athletics Federation of India has announced special recognition for this historic achievement.</p>', category: 'sports', image_url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80', author: 'Rohan Deshpande', featured: 0 },
        { title: 'India-EU Free Trade Agreement Finalized After Decade of Negotiations', excerpt: 'The comprehensive deal covers goods, services, investments, and digital trade.', content: '<p>After more than a decade of negotiations, India and the European Union have finalized a comprehensive Free Trade Agreement.</p><p>Under the agreement, tariffs on approximately 90% of goods will be eliminated over a 10-year period. As what reportersays in the international trade coverage, this deal could boost India-EU bilateral trade by up to 40%.</p><p>The agreement is expected to be formally signed at the India-EU Summit next month.</p>', category: 'world', image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80', author: 'Shalini Kapoor', featured: 0 },
        { title: 'Indian Scientists Decode New High-Yield Wheat Variety Resistant to Climate Change', excerpt: 'The genetically mapped wheat strain promises 40% higher yields and can withstand temperatures up to 42C.', content: '<p>Scientists at the Indian Agricultural Research Institute have decoded the genome of a new high-yield wheat variety resistant to climate change effects.</p><p>The variety Ujjwal-2026 can withstand temperatures up to 42 degrees Celsius while producing 40% higher yields. As reportersays in the agricultural science reporting, this development could ensure India\'s food security in the face of climate change.</p><p>The government has announced plans to distribute seeds ahead of the next Rabi season.</p>', category: 'science', image_url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80', author: 'Dr. Ramesh Chand', featured: 0 }
    ];
    const insertArticle = db.prepare('INSERT OR IGNORE INTO cms_articles (title, slug, excerpt, content, category, image_url, author, status, featured, published_at, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const now = new Date();
    for (let i = 0; i < seedArticles.length; i++) {
        const a = seedArticles[i];
        const slug = a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
        const pubDate = new Date(now.getTime() - (i + 1) * 3600000).toISOString();
        insertArticle.run(a.title, slug + '-' + (i + 1), a.excerpt, a.content, a.category, a.image_url, a.author, 'published', a.featured, pubDate, a.title, a.excerpt);
    }
    console.log(`Seeded ${seedArticles.length} sample articles into CMS`);
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
// Auth Middleware & Admin Login
// ============================================================

// Audit logging helper
function logAudit(action, details, req) {
    try {
        const ip = req ? (req.ip || req.connection.remoteAddress) : 'system';
        const ua = req ? (req.headers['user-agent'] || '') : 'system';
        db.prepare('INSERT INTO audit_log (action, details, ip_address, user_agent) VALUES (?, ?, ?, ?)').run(action, details, ip, ua);
    } catch (e) { console.error('Audit log error:', e.message); }
}

// Session activity tracking
const sessionActivity = new Map(); // token -> lastActivity timestamp

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

// Clean up expired session activity records every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [token, lastActivity] of sessionActivity.entries()) {
        if ((now - lastActivity) > SESSION_INACTIVITY_TIMEOUT * 2) sessionActivity.delete(token);
    }
}, 10 * 60 * 1000);

// Admin login - returns JWT token (with rate limiting and lockout)
app.post('/api/admin/login', loginLimiter, checkLoginLockout, (req, res) => {
    try {
        const { password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }
        const row = db.prepare("SELECT value FROM cms_settings WHERE key = 'admin_password'").get();
        if (!row) {
            return res.status(500).json({ success: false, message: 'Admin password not configured' });
        }
        const isValid = bcrypt.compareSync(password, row.value);
        if (!isValid) {
            recordLoginAttempt(ip, false);
            logAudit('admin_login_failed', 'Failed admin login attempt', req);
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }
        recordLoginAttempt(ip, true);
        const token = jwt.sign({ role: 'admin', iat: Math.floor(Date.now() / 1000) }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        sessionActivity.set(token, Date.now());
        logAudit('admin_login', 'Admin logged in successfully', req);
        res.json({ success: true, token, expiresIn: JWT_EXPIRY });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Verify token endpoint (for session check)
app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ success: true, message: 'Token is valid' });
});

// Change admin password
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }
        const row = db.prepare("SELECT value FROM cms_settings WHERE key = 'admin_password'").get();
        if (!bcrypt.compareSync(currentPassword, row.value)) {
            logAudit('password_change_failed', 'Incorrect current password', req);
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        const hashed = bcrypt.hashSync(newPassword, 10);
        db.prepare("UPDATE cms_settings SET value = ? WHERE key = 'admin_password'").run(hashed);
        logAudit('password_changed', 'Admin password changed', req);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

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

// List devices for portal (no admin JWT required, used by portal UI)
app.get('/api/portal/devices', (req, res) => {
    try {
        const devices = stmts.getAllDevices.all();
        res.json({
            success: true,
            count: devices.length,
            devices: devices.map(d => ({
                deviceId: d.device_id,
                hostname: d.hostname,
                remotePort: d.remote_port,
                isOnline: d.is_online === 1,
                lastHeartbeat: d.last_heartbeat
            }))
        });
    } catch (err) {
        console.error('Portal list devices error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// List all devices (admin - includes extra fields)
app.get('/api/devices', requireAdmin, (req, res) => {
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

// Self-deregister device (used by uninstaller, authenticates with device auth token)
app.post('/api/devices/deregister', (req, res) => {
    try {
        const { deviceId, authToken } = req.body;
        if (!deviceId || !authToken) {
            return res.status(400).json({ success: false, message: 'deviceId and authToken required' });
        }
        const device = stmts.findDevice.get(deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }
        if (device.auth_token !== authToken) {
            return res.status(403).json({ success: false, message: 'Invalid auth token' });
        }
        stmts.deleteDevice.run(deviceId);
        db.prepare('DELETE FROM device_assignments WHERE device_id = ?').run(deviceId);
        res.json({ success: true, message: 'Device deregistered' });
    } catch (err) {
        console.error('Deregister device error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Delete device
app.delete('/api/devices/:deviceId', requireAdmin, (req, res) => {
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
app.post('/api/devices/register', requireAdmin, (req, res) => {
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
app.post('/api/set-rdp-creds', requireAdmin, (req, res) => {
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
app.post('/api/clear-rdp-creds', requireAdmin, (req, res) => {
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

// Connect to external RDP (cloud VM, any IP) - creates ad-hoc Guacamole connection
app.post('/api/connect-external-rdp', (req, res) => {
    const { hostname, port, username, password, label } = req.body;
    if (!hostname || !username || !password) {
        return res.json({ success: false, message: 'Missing required fields (hostname, username, password)' });
    }
    
    const rdpPort = port || '3389';
    const connName = label || ('Cloud VM - ' + hostname);
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    try {
        const currentXml = execSync('docker exec guacamole cat /etc/guacamole/user-mapping.xml', { encoding: 'utf8' });
        
        // Remove existing connection with same name if any
        let updatedXml = currentXml.replace(
            new RegExp(`\\s*<connection name="${connName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">[\\s\\S]*?</connection>`, 'g'),
            ''
        );
        
        // Build the new external RDP connection block
        const newConn = `
        <connection name="${connName}">
            <protocol>rdp</protocol>
            <param name="hostname">${hostname}</param>
            <param name="port">${rdpPort}</param>
            <param name="username">${username}</param>
            <param name="password">${password}</param>
            <param name="ignore-cert">true</param>
            <param name="security">any</param>
            <param name="resize-method">reconnect</param>
            <param name="enable-wallpaper">true</param>
            <param name="enable-font-smoothing">true</param>
            <param name="enable-theming">true</param>
            <param name="enable-full-window-drag">true</param>
            <param name="disable-copy">false</param>
            <param name="disable-paste">false</param>
            <param name="enable-drive">true</param>
            <param name="drive-name">Shared</param>
            <param name="drive-path">/tmp/guac-drive</param>
            <param name="create-drive-path">true</param>
        </connection>`;
        
        // Insert before </authorize>
        updatedXml = updatedXml.replace('</authorize>', newConn + '\n    </authorize>');
        
        fs.writeFileSync('/tmp/user-mapping-temp.xml', updatedXml);
        execSync('docker cp /tmp/user-mapping-temp.xml guacamole:/etc/guacamole/user-mapping.xml');
        execSync('docker exec guacamole touch /etc/guacamole/user-mapping.xml');
        
        console.log(`External RDP connection created: ${connName} -> ${hostname}:${rdpPort}`);
        res.json({ success: true, connName, message: 'Connection created' });
    } catch (err) {
        console.error('Connect external RDP error:', err.message);
        res.json({ success: false, message: err.message });
    }
});

// Disconnect external RDP - removes the ad-hoc connection from Guacamole
app.post('/api/disconnect-external-rdp', (req, res) => {
    const { connName } = req.body;
    if (!connName) {
        return res.json({ success: false, message: 'Missing connName' });
    }
    
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    try {
        const currentXml = execSync('docker exec guacamole cat /etc/guacamole/user-mapping.xml', { encoding: 'utf8' });
        
        const updatedXml = currentXml.replace(
            new RegExp(`\\s*<connection name="${connName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">[\\s\\S]*?</connection>`, 'g'),
            ''
        );
        
        fs.writeFileSync('/tmp/user-mapping-temp.xml', updatedXml);
        execSync('docker cp /tmp/user-mapping-temp.xml guacamole:/etc/guacamole/user-mapping.xml');
        execSync('docker exec guacamole touch /etc/guacamole/user-mapping.xml');
        
        console.log(`External RDP connection removed: ${connName}`);
        res.json({ success: true });
    } catch (err) {
        console.error('Disconnect external RDP error:', err.message);
        res.json({ success: false, message: err.message });
    }
});

// ============================================================
// Portal Users API Routes
// ============================================================

// Login - authenticate portal user
app.post('/api/portal/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }
        const user = db.prepare('SELECT * FROM portal_users WHERE username = ? AND is_active = 1').get(username);
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
        // Get assigned devices
        const assignments = db.prepare('SELECT device_id FROM device_assignments WHERE user_id = ?').all(user.id);
        const assignedDevices = assignments.map(a => a.device_id);
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                role: user.role,
                assignedDevices
            }
        });
    } catch (err) {
        console.error('Portal login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// List all portal users
app.get('/api/portal/users', requireAdmin, (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, display_name, role, is_active, created_at, updated_at FROM portal_users ORDER BY created_at DESC').all();
        // Get device assignments for each user
        const getAssignments = db.prepare('SELECT device_id FROM device_assignments WHERE user_id = ?');
        const result = users.map(u => ({
            ...u,
            assignedDevices: getAssignments.all(u.id).map(a => a.device_id)
        }));
        res.json({ success: true, users: result });
    } catch (err) {
        console.error('List portal users error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Create portal user
app.post('/api/portal/users', requireAdmin, (req, res) => {
    try {
        const { username, password, display_name, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }
        const existing = db.prepare('SELECT id FROM portal_users WHERE username = ?').get(username);
        if (existing) {
            return res.status(409).json({ success: false, message: 'Username already exists' });
        }
        const hashedPw = bcrypt.hashSync(password, 10);
        const result = db.prepare('INSERT INTO portal_users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run(
            username, hashedPw, display_name || '', role || 'user'
        );
        res.json({ success: true, id: result.lastInsertRowid, message: 'User created' });
    } catch (err) {
        console.error('Create portal user error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update portal user
app.put('/api/portal/users/:id', requireAdmin, (req, res) => {
    try {
        const { username, password, display_name, role, is_active } = req.body;
        const user = db.prepare('SELECT * FROM portal_users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Check username uniqueness if changing
        if (username && username !== user.username) {
            const dup = db.prepare('SELECT id FROM portal_users WHERE username = ? AND id != ?').get(username, req.params.id);
            if (dup) return res.status(409).json({ success: false, message: 'Username already taken' });
        }
        const hashedPw = password ? bcrypt.hashSync(password, 10) : user.password;
        db.prepare(`UPDATE portal_users SET 
            username = ?, password = ?, display_name = ?, role = ?, is_active = ?, updated_at = datetime('now')
            WHERE id = ?`).run(
            username || user.username,
            hashedPw,
            display_name !== undefined ? display_name : user.display_name,
            role || user.role,
            is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
            req.params.id
        );
        res.json({ success: true, message: 'User updated' });
    } catch (err) {
        console.error('Update portal user error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Delete portal user
app.delete('/api/portal/users/:id', requireAdmin, (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM portal_users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Delete assignments first, then user
        db.prepare('DELETE FROM device_assignments WHERE user_id = ?').run(req.params.id);
        db.prepare('DELETE FROM portal_users WHERE id = ?').run(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error('Delete portal user error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Assign device to user
app.post('/api/portal/users/:id/devices', requireAdmin, (req, res) => {
    try {
        const { device_id } = req.body;
        if (!device_id) {
            return res.status(400).json({ success: false, message: 'device_id is required' });
        }
        const user = db.prepare('SELECT * FROM portal_users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        try {
            db.prepare('INSERT INTO device_assignments (user_id, device_id) VALUES (?, ?)').run(req.params.id, device_id);
        } catch (e) {
            if (e.message.includes('UNIQUE')) {
                return res.json({ success: true, message: 'Device already assigned' });
            }
            throw e;
        }
        res.json({ success: true, message: 'Device assigned' });
    } catch (err) {
        console.error('Assign device error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Unassign device from user
app.delete('/api/portal/users/:id/devices/:deviceId', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM device_assignments WHERE user_id = ? AND device_id = ?').run(req.params.id, req.params.deviceId);
        res.json({ success: true, message: 'Device unassigned' });
    } catch (err) {
        console.error('Unassign device error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get devices assigned to a user
app.get('/api/portal/users/:id/devices', requireAdmin, (req, res) => {
    try {
        const assignments = db.prepare('SELECT device_id FROM device_assignments WHERE user_id = ?').all(req.params.id);
        res.json({ success: true, devices: assignments.map(a => a.device_id) });
    } catch (err) {
        console.error('Get user devices error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Bulk update device assignments for a user
app.put('/api/portal/users/:id/devices', requireAdmin, (req, res) => {
    try {
        const { device_ids } = req.body;
        if (!Array.isArray(device_ids)) {
            return res.status(400).json({ success: false, message: 'device_ids must be an array' });
        }
        const user = db.prepare('SELECT * FROM portal_users WHERE id = ?').get(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Replace all assignments
        const deleteAll = db.prepare('DELETE FROM device_assignments WHERE user_id = ?');
        const insertOne = db.prepare('INSERT INTO device_assignments (user_id, device_id) VALUES (?, ?)');
        const updateAssignments = db.transaction((userId, deviceIds) => {
            deleteAll.run(userId);
            for (const did of deviceIds) {
                insertOne.run(userId, did);
            }
        });
        updateAssignments(parseInt(req.params.id), device_ids);
        res.json({ success: true, message: 'Device assignments updated' });
    } catch (err) {
        console.error('Bulk update assignments error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
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
app.get('/api/cms/articles', requireAdmin, (req, res) => {
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
        const total = status ? db.prepare('SELECT COUNT(*) as c FROM cms_articles WHERE status = ?').get(status) : db.prepare('SELECT COUNT(*) as c FROM cms_articles').get();
        res.json({ success: true, articles, total: total ? total.c : articles.length });
    } catch (err) {
        console.error('CMS list articles error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/cms/articles/:id', requireAdmin, (req, res) => {
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

app.post('/api/cms/articles', requireAdmin, (req, res) => {
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

app.put('/api/cms/articles/:id', requireAdmin, (req, res) => {
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

app.delete('/api/cms/articles/:id', requireAdmin, (req, res) => {
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

app.post('/api/cms/categories', requireAdmin, (req, res) => {
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

app.delete('/api/cms/categories/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM cms_categories WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- Settings ---
app.get('/api/cms/settings', requireAdmin, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM cms_settings').all();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        // Never expose admin password hash to client
        delete settings.admin_password;
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/cms/settings', requireAdmin, (req, res) => {
    try {
        const updates = req.body;
        const upsert = db.prepare('INSERT OR REPLACE INTO cms_settings (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(updates)) {
            // Don't allow password changes through settings - use /api/admin/change-password
            if (key === 'admin_password') continue;
            upsert.run(key, String(value));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- RSS Feeds ---
app.get('/api/cms/feeds', requireAdmin, (req, res) => {
    try {
        const feeds = db.prepare('SELECT * FROM cms_rss_feeds ORDER BY created_at DESC').all();
        res.json({ success: true, feeds });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/cms/feeds', requireAdmin, (req, res) => {
    try {
        const { name, url, category, enabled } = req.body;
        if (!name || !url) return res.status(400).json({ success: false, message: 'Name and URL required' });
        db.prepare('INSERT INTO cms_rss_feeds (name, url, category, enabled) VALUES (?, ?, ?, ?)').run(name, url, category || 'general', enabled !== undefined ? (enabled ? 1 : 0) : 1);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/cms/feeds/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM cms_rss_feeds WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- AI Log ---
app.get('/api/cms/ai-log', requireAdmin, (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM cms_ai_log ORDER BY created_at DESC LIMIT 50').all();
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- AI Rewrite single article ---
app.post('/api/cms/ai-rewrite', requireAdmin, async (req, res) => {
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
app.post('/api/cms/fetch-rss', requireAdmin, async (req, res) => {
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

// --- AI Generate Articles Across All Categories ---
app.post('/api/cms/ai-generate', requireAdmin, async (req, res) => {
    try {
        const settings = {};
        db.prepare('SELECT * FROM cms_settings').all().forEach(r => settings[r.key] = r.value);
        const apiKey = settings.ai_api_key;
        const provider = settings.ai_provider || 'openrouter';
        const model = settings.ai_model || 'google/gemini-2.0-flash-001';

        if (!apiKey) return res.status(400).json({ success: false, message: 'AI API key not configured. Go to Settings > AI Settings.' });

        const categories = db.prepare('SELECT * FROM cms_categories ORDER BY sort_order').all();
        if (categories.length === 0) return res.json({ success: false, message: 'No categories found' });

        const { count = 1, mode = 'all', category = '', topic = '' } = req.body;
        const articlesPerCategory = Math.min(Math.max(1, parseInt(count) || 1), 5);
        let totalGenerated = 0;
        const errors = [];

        // Topic ideas per category for diverse content
        const topicIdeas = {
            'Politics': ['government policy reform', 'election campaign updates', 'parliament session highlights', 'state politics developments', 'political alliance shifts'],
            'Business': ['stock market analysis', 'startup funding news', 'corporate earnings report', 'economic growth indicators', 'trade policy impact'],
            'Sports': ['cricket match highlights', 'football league updates', 'Olympic athlete training', 'tennis tournament results', 'sports team transfer news'],
            'Technology': ['AI innovation breakthrough', 'smartphone launch review', 'cybersecurity threat alert', 'space technology mission', 'electric vehicle advancement'],
            'Entertainment': ['Bollywood movie release', 'OTT platform new series', 'music album launch', 'celebrity interview highlights', 'film festival awards'],
            'World': ['international diplomacy summit', 'global climate change action', 'UN peacekeeping mission', 'world economy forecast', 'international trade agreement'],
            'Health': ['public health initiative', 'medical research breakthrough', 'mental health awareness campaign', 'nutrition and wellness trends', 'hospital infrastructure development'],
            'Science': ['space exploration discovery', 'quantum computing progress', 'genetic research milestone', 'environmental science study', 'archaeological finding revealed'],
            'Opinion': ['editorial on education reform', 'opinion on digital privacy', 'analysis of foreign policy', 'commentary on social media impact', 'perspective on urban development'],
            'War': ['India border security update', 'military defense technology upgrade', 'geopolitical conflict analysis', 'armed forces modernization', 'peacekeeping operations report'],
            'Education': ['CBSE board exam reform', 'IIT JEE preparation tips', 'NEP 2020 implementation update', 'university ranking changes', 'scholarship and fellowship announcements'],
            'Jobs': ['government job recruitment notification', 'IT sector hiring trends', 'startup job market analysis', 'UPSC exam preparation guide', 'skill development initiative launched'],
            'Cricket': ['India vs Pakistan match analysis', 'Test cricket series highlights', 'women cricket team performance', 'domestic cricket tournament update', 'cricket player injury and fitness news'],
            'IPL': ['IPL team auction strategy', 'IPL match day highlights and scores', 'IPL player performance review', 'IPL franchise business analysis', 'IPL emerging players to watch'],
            'Gadget Reviews': ['latest smartphone review and comparison', 'laptop buying guide for students', 'smartwatch and wearable tech review', 'budget gadget recommendations India', 'upcoming gadget launches in India']
        };

        // Filter categories based on mode
        let targetCategories = categories;
        if (mode === 'single_category' && category) {
            targetCategories = categories.filter(c => c.name === category);
            if (targetCategories.length === 0) return res.json({ success: false, message: `Category "${category}" not found` });
        }

        const seoPrompt = `You are a senior investigative reporter at News Reporter Live, India's trusted digital news source. Write an ORIGINAL, exclusive news article about the given topic. 

CRITICAL RULES:
1. Write in first-person reporter style with natural, conversational Indian English
2. Use the inverted pyramid structure: most important facts first
3. Include realistic quotes from unnamed sources (e.g., "A senior official told News Reporter Live...")
4. SEO OPTIMIZATION: Use the main keyword in the title, first paragraph, one subheading, and naturally 3-4 times throughout
5. Include 2-3 subheadings using <h3> tags for SEO
6. Write 500-800 words in multiple <p> paragraphs
7. Include the exact word "reportersays" naturally ONCE in the middle of the article (e.g., "as reportersays from the ground...")
8. Make it sound like a REAL reporter wrote this - use location details, time references, and specific details
9. DO NOT use phrases like "In conclusion", "Furthermore", "It is worth noting" - these sound robotic
10. Add a compelling, click-worthy headline that includes the main keyword

IMPORTANT: Respond ONLY with raw JSON. Do NOT wrap in markdown code blocks. No \`\`\`json or \`\`\`. Just the raw JSON object starting with { and ending with }.`;

        for (const cat of targetCategories) {
            const topics = topicIdeas[cat.name] || [`latest ${cat.name.toLowerCase()} news in India`, `breaking ${cat.name.toLowerCase()} update today`];

            for (let i = 0; i < articlesPerCategory; i++) {
                try {
                    const chosenTopic = (mode === 'single_topic' && topic) ? topic : topics[Math.floor(Math.random() * topics.length)];
                    const dateContext = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                    const result = await callAI(provider, apiKey, model, seoPrompt,
                        `Write an original ${cat.name} news article about: ${chosenTopic}`,
                        `Category: ${cat.name}\nTopic: ${chosenTopic}\nDate: ${dateContext}\nPublication: News Reporter Live\n\nWrite a fresh, original article about this topic as if reporting live from India today.`
                    );

                    if (result && result.title && result.content) {
                        // Fetch thumbnail image based on category
                        const imageQuery = result.image_query || topic;
                        let imageUrl = '';
                        try {
                            imageUrl = await searchUnsplashImage(cat.name.toLowerCase() + ' ' + imageQuery);
                        } catch (imgErr) {
                            console.error('Image search failed:', imgErr.message);
                            imageUrl = `https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=800&q=80`;
                        }

                        const slug = generateSlug(result.title);
                        const excerpt = result.excerpt || result.content.replace(/<[^>]+>/g, '').substring(0, 200);
                        const metaDesc = result.meta_description || excerpt.substring(0, 160);
                        const metaKeywords = result.meta_keywords || '';

                        const manualAuthor = getAuthorForCategory(cat.name);
                        db.prepare(`
                            INSERT INTO cms_articles (title, slug, excerpt, content, category, image_url, author, status, source_url, ai_generated, published_at, meta_description)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, 1, ?, ?)
                        `).run(result.title, slug, excerpt, result.content, cat.name, imageUrl, manualAuthor.name, 'ai-generated', new Date().toISOString(), metaDesc);

                        db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status) VALUES (?, ?, ?)').run('ai-generated', result.title, 'auto-published');
                        totalGenerated++;
                        console.log(`Generated article: "${result.title}" by ${manualAuthor.name} in ${cat.name}`);
                    }
                } catch (genErr) {
                    const errMsg = `${cat.name}: ${genErr.message}`;
                    errors.push(errMsg);
                    console.error('AI generation error:', errMsg);
                    db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status, error_message) VALUES (?, ?, ?, ?)').run('ai-generate', cat.name, 'error', genErr.message);
                }

                // Small delay between requests to avoid rate limiting
                if (i < articlesPerCategory - 1 || categories.indexOf(cat) < categories.length - 1) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
        }

        res.json({ success: true, generated: totalGenerated, total_categories: categories.length, errors: errors.length > 0 ? errors : undefined });
    } catch (err) {
        console.error('AI generate error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- CMS Stats ---
app.get('/api/cms/stats', requireAdmin, (req, res) => {
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

// --- Sitemap XML ---
app.get('/sitemap.xml', (req, res) => {
    try {
        const articles = db.prepare('SELECT slug, updated_at, published_at FROM cms_articles WHERE status = ? ORDER BY published_at DESC').all('published');
        const baseUrl = 'https://newsreporter.live';
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        xml += `  <url><loc>${baseUrl}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>\n`;
        for (const a of articles) {
            const lastmod = (a.updated_at || a.published_at || '').split(' ')[0];
            xml += `  <url><loc>${baseUrl}/article/${a.slug}</loc>${lastmod ? '<lastmod>' + lastmod + '</lastmod>' : ''}<changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
        }
        const categories = db.prepare('SELECT slug FROM cms_categories ORDER BY sort_order').all();
        for (const c of categories) {
            xml += `  <url><loc>${baseUrl}/category/${c.slug}</loc><changefreq>daily</changefreq><priority>0.6</priority></url>\n`;
        }
        xml += '</urlset>';
        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send('Error generating sitemap');
    }
});

// --- Robots.txt ---
app.get('/robots.txt', (req, res) => {
    const txt = `User-agent: *\nAllow: /\nSitemap: https://newsreporter.live/sitemap.xml\n`;
    res.set('Content-Type', 'text/plain');
    res.send(txt);
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
        // Track detailed view
        try {
            const ip = req.ip || req.connection.remoteAddress;
            const ua = req.headers['user-agent'] || '';
            db.prepare('INSERT INTO article_views (article_id, ip_address, user_agent) VALUES (?, ?, ?)').run(article.id, ip, ua);
        } catch (e) { /* ignore view tracking errors */ }
        res.json({ success: true, article });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Image Upload API
// ============================================================
app.post('/api/upload/image', requireAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
        const imageUrl = `/uploads/${req.file.filename}`;
        logAudit('image_upload', `Uploaded image: ${req.file.originalname}`, req);
        res.json({ success: true, url: imageUrl, filename: req.file.filename });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Comments API
// ============================================================
// Public: Submit comment
app.post('/api/comments', publicWriteLimiter, (req, res) => {
    try {
        const { article_id, author_email } = req.body;
        let { author_name, content } = req.body;
        if (!article_id || !author_name || !content) {
            return res.status(400).json({ success: false, message: 'Article ID, author name, and content are required' });
        }
        // XSS sanitization
        author_name = sanitizeInput(author_name).substring(0, 100);
        content = sanitizeInput(content);
        if (content.length > 2000) return res.status(400).json({ success: false, message: 'Comment too long (max 2000 chars)' });
        if (!content.trim()) return res.status(400).json({ success: false, message: 'Comment content cannot be empty after sanitization' });
        const article = db.prepare('SELECT id FROM cms_articles WHERE id = ? AND status = ?').get(article_id, 'published');
        if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
        const ip = req.ip || req.connection.remoteAddress;
        db.prepare('INSERT INTO comments (article_id, author_name, author_email, content, ip_address) VALUES (?, ?, ?, ?, ?)').run(article_id, author_name, sanitizeInput(author_email || ''), content, ip);
        res.json({ success: true, message: 'Comment submitted for moderation' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Public: Get approved comments for an article
app.get('/api/comments/:articleId', (req, res) => {
    try {
        const comments = db.prepare('SELECT id, author_name, content, created_at FROM comments WHERE article_id = ? AND status = ? ORDER BY created_at DESC').all(req.params.articleId, 'approved');
        res.json({ success: true, comments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin: Get all comments with moderation
app.get('/api/admin/comments', requireAdmin, (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT c.*, a.title as article_title FROM comments c LEFT JOIN cms_articles a ON c.article_id = a.id';
        const params = [];
        if (status) { sql += ' WHERE c.status = ?'; params.push(status); }
        sql += ' ORDER BY c.created_at DESC LIMIT 100';
        const comments = db.prepare(sql).all(...params);
        const counts = {
            pending: db.prepare('SELECT COUNT(*) as c FROM comments WHERE status = ?').get('pending').c,
            approved: db.prepare('SELECT COUNT(*) as c FROM comments WHERE status = ?').get('approved').c,
            rejected: db.prepare('SELECT COUNT(*) as c FROM comments WHERE status = ?').get('rejected').c
        };
        res.json({ success: true, comments, counts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin: Moderate comment
app.put('/api/admin/comments/:id', requireAdmin, (req, res) => {
    try {
        const { status } = req.body;
        if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
        db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(status, req.params.id);
        logAudit('comment_moderated', `Comment ${req.params.id} ${status}`, req);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin: Delete comment
app.delete('/api/admin/comments/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
        logAudit('comment_deleted', `Comment ${req.params.id} deleted`, req);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Newsletter API
// ============================================================
// Public: Subscribe
app.post('/api/newsletter/subscribe', publicWriteLimiter, (req, res) => {
    try {
        const { email, name } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Valid email is required' });
        }
        const existing = db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').get(email);
        if (existing) {
            if (existing.is_active) return res.json({ success: true, message: 'Already subscribed' });
            db.prepare('UPDATE newsletter_subscribers SET is_active = 1, unsubscribed_at = NULL WHERE email = ?').run(email);
            return res.json({ success: true, message: 'Re-subscribed successfully' });
        }
        db.prepare('INSERT INTO newsletter_subscribers (email, name) VALUES (?, ?)').run(email, name || '');
        res.json({ success: true, message: 'Subscribed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Public: Unsubscribe
app.post('/api/newsletter/unsubscribe', publicWriteLimiter, (req, res) => {
    try {
        const { email } = req.body;
        db.prepare("UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = datetime('now') WHERE email = ?").run(email);
        res.json({ success: true, message: 'Unsubscribed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin: Get subscribers
app.get('/api/admin/newsletter', requireAdmin, (req, res) => {
    try {
        const subscribers = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC').all();
        const active = subscribers.filter(s => s.is_active).length;
        res.json({ success: true, subscribers, activeCount: active, totalCount: subscribers.length });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin: Delete subscriber
app.delete('/api/admin/newsletter/:id', requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Analytics API
// ============================================================
app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    try {
        const { period } = req.query; // 7d, 30d, 90d
        const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
        
        // Views over time
        const viewsByDay = db.prepare(`
            SELECT DATE(viewed_at) as date, COUNT(*) as views 
            FROM article_views 
            WHERE viewed_at >= datetime('now', '-${days} days')
            GROUP BY DATE(viewed_at) ORDER BY date
        `).all();

        // Popular articles
        const popularArticles = db.prepare(`
            SELECT a.id, a.title, a.category, a.views, COUNT(av.id) as recent_views
            FROM cms_articles a
            LEFT JOIN article_views av ON a.id = av.article_id AND av.viewed_at >= datetime('now', '-${days} days')
            WHERE a.status = 'published'
            GROUP BY a.id ORDER BY recent_views DESC LIMIT 10
        `).all();

        // Popular categories
        const popularCategories = db.prepare(`
            SELECT a.category, SUM(a.views) as total_views, COUNT(a.id) as article_count
            FROM cms_articles a WHERE a.status = 'published'
            GROUP BY a.category ORDER BY total_views DESC
        `).all();

        // Total stats
        const totalViews = db.prepare('SELECT COUNT(*) as c FROM article_views').get().c;
        const todayViews = db.prepare("SELECT COUNT(*) as c FROM article_views WHERE viewed_at >= datetime('now', 'start of day')").get().c;
        const totalArticles = db.prepare("SELECT COUNT(*) as c FROM cms_articles WHERE status = 'published'").get().c;
        const totalComments = db.prepare('SELECT COUNT(*) as c FROM comments').get().c;
        const totalSubscribers = db.prepare('SELECT COUNT(*) as c FROM newsletter_subscribers WHERE is_active = 1').get().c;

        res.json({
            success: true,
            analytics: {
                viewsByDay, popularArticles, popularCategories,
                totalViews, todayViews, totalArticles, totalComments, totalSubscribers
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Audit Log API
// ============================================================
app.get('/api/admin/audit-log', requireAdmin, (req, res) => {
    try {
        const { limit } = req.query;
        const logs = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(parseInt(limit) || 100);
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Scheduled Publishing
// ============================================================
// Cron job: check for scheduled articles every minute
cron.schedule('* * * * *', () => {
    try {
        const now = new Date().toISOString();
        const scheduled = db.prepare("SELECT id, title FROM cms_articles WHERE status = 'scheduled' AND scheduled_at <= ?").all(now);
        for (const article of scheduled) {
            db.prepare("UPDATE cms_articles SET status = 'published', published_at = datetime('now') WHERE id = ?").run(article.id);
            logAudit('scheduled_publish', `Auto-published scheduled article: ${article.title}`, { ip: 'system', headers: {} });
            console.log(`Auto-published scheduled article: ${article.title}`);
        }
    } catch (e) { console.error('Scheduled publish error:', e.message); }
});

// ============================================================
// Connection Activity Logs API
// ============================================================
app.post('/api/connection-log', (req, res) => {
    try {
        const { user_id, username, device_id, connection_type } = req.body;
        if (!device_id) return res.status(400).json({ success: false, message: 'device_id required' });
        const ip = req.ip || req.connection.remoteAddress;
        const result = db.prepare('INSERT INTO connection_logs (user_id, username, device_id, connection_type, ip_address) VALUES (?, ?, ?, ?, ?)').run(user_id || null, username || 'unknown', device_id, connection_type || 'rdp', ip);
        res.json({ success: true, logId: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/connection-log/:id/end', (req, res) => {
    try {
        db.prepare("UPDATE connection_logs SET ended_at = datetime('now'), duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER) WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/admin/connection-logs', requireAdmin, (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM connection_logs ORDER BY started_at DESC LIMIT 200').all();
        res.json({ success: true, logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Wake-on-LAN API
// ============================================================
app.post('/api/admin/wake-on-lan', requireAdmin, (req, res) => {
    try {
        const { mac_address, device_id } = req.body;
        if (!mac_address) return res.status(400).json({ success: false, message: 'MAC address required' });
        // Build WOL magic packet
        const macBytes = mac_address.replace(/[:-]/g, '').match(/.{2}/g).map(b => parseInt(b, 16));
        const magicPacket = Buffer.alloc(102);
        for (let i = 0; i < 6; i++) magicPacket[i] = 0xff;
        for (let i = 0; i < 16; i++) {
            for (let j = 0; j < 6; j++) {
                magicPacket[6 + i * 6 + j] = macBytes[j];
            }
        }
        const dgram = require('dgram');
        const client = dgram.createSocket('udp4');
        client.send(magicPacket, 0, magicPacket.length, 9, '255.255.255.255', (err) => {
            client.close();
            if (err) return res.status(500).json({ success: false, message: 'Failed to send WOL packet' });
            logAudit('wake_on_lan', `WOL sent to ${mac_address} (${device_id || 'unknown'})`, req);
            res.json({ success: true, message: 'Wake-on-LAN packet sent' });
        });
        client.setBroadcast(true);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// Portal Login with Rate Limiting + TOTP/2FA
// ============================================================
// TOTP helper functions
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

// Setup 2FA for portal user
app.post('/api/portal/users/:id/setup-2fa', requireAdmin, (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM portal_users WHERE id = ?').get(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        const secret = generateTOTPSecret();
        db.prepare('UPDATE portal_users SET totp_secret = ? WHERE id = ?').run(secret, req.params.id);
        // Generate otpauth URI for QR code
        const otpauthUrl = `otpauth://totp/NewsReporter:${user.username}?secret=${Buffer.from(secret, 'hex').toString('base32') || secret}&issuer=NewsReporter&algorithm=SHA1&digits=6&period=30`;
        logAudit('2fa_setup', `2FA setup for portal user: ${user.username}`, req);
        res.json({ success: true, secret, otpauthUrl, message: 'Scan the QR code or enter the secret in your authenticator app' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Enable 2FA for portal user
app.post('/api/portal/users/:id/enable-2fa', requireAdmin, (req, res) => {
    try {
        const { token } = req.body;
        const user = db.prepare('SELECT * FROM portal_users WHERE id = ?').get(req.params.id);
        if (!user || !user.totp_secret) return res.status(400).json({ success: false, message: 'Setup 2FA first' });
        if (!verifyTOTP(user.totp_secret, token)) return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
        db.prepare('UPDATE portal_users SET totp_enabled = 1 WHERE id = ?').run(req.params.id);
        logAudit('2fa_enabled', `2FA enabled for portal user: ${user.username}`, req);
        res.json({ success: true, message: '2FA enabled successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Disable 2FA for portal user
app.post('/api/portal/users/:id/disable-2fa', requireAdmin, (req, res) => {
    try {
        db.prepare('UPDATE portal_users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.params.id);
        logAudit('2fa_disabled', `2FA disabled for portal user ${req.params.id}`, req);
        res.json({ success: true, message: '2FA disabled' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// SEO Structured Data API (JSON-LD) - Enhanced with Rich Snippets
// ============================================================
app.get('/api/news/:slug/structured-data', (req, res) => {
    try {
        const article = db.prepare('SELECT * FROM cms_articles WHERE slug = ? AND status = ?').get(req.params.slug, 'published');
        if (!article) return res.status(404).json({ success: false });
        const siteName = db.prepare("SELECT value FROM cms_settings WHERE key = 'site_name'").get();
        const authorInfo = getAuthorForCategory(article.category);
        const wordCount = article.content ? article.content.replace(/<[^>]+>/g, ' ').split(/\s+/).length : 500;
        
        const jsonLd = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": article.title,
            "description": article.meta_description || article.excerpt || '',
            "image": article.image_url ? [article.image_url] : [],
            "datePublished": article.published_at || article.created_at,
            "dateModified": article.updated_at || article.published_at || article.created_at,
            "author": {
                "@type": "Person",
                "name": article.author || authorInfo.name,
                "jobTitle": authorInfo.title,
                "url": authorInfo.url,
                "worksFor": {
                    "@type": "NewsMediaOrganization",
                    "name": "News Reporter Live",
                    "url": "https://newsreporter.live"
                }
            },
            "publisher": {
                "@type": "NewsMediaOrganization",
                "name": (siteName && siteName.value) || "News Reporter Live",
                "url": "https://newsreporter.live",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://newsreporter.live/logo.png",
                    "width": 600,
                    "height": 60
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `https://newsreporter.live/article/${article.slug}`
            },
            "articleSection": article.category,
            "keywords": article.meta_keywords || article.category,
            "wordCount": wordCount,
            "inLanguage": "en-IN",
            "isAccessibleForFree": true,
            "copyrightHolder": {
                "@type": "Organization",
                "name": "News Reporter Live"
            },
            "copyrightYear": new Date(article.published_at || article.created_at).getFullYear()
        };
        
        // Breadcrumb structured data
        const breadcrumb = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://newsreporter.live/" },
                { "@type": "ListItem", "position": 2, "name": article.category, "item": `https://newsreporter.live/?category=${encodeURIComponent(article.category.toLowerCase())}` },
                { "@type": "ListItem", "position": 3, "name": article.title, "item": `https://newsreporter.live/article/${article.slug}` }
            ]
        };
        
        res.json({ success: true, jsonLd, breadcrumb });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// SEO: Sitemap.xml (dynamic)
// ============================================================
app.get('/sitemap.xml', (req, res) => {
    try {
        const articles = db.prepare("SELECT slug, published_at, updated_at, category FROM cms_articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 1000").all();
        const categories = db.prepare('SELECT name FROM cms_categories ORDER BY sort_order').all();
        
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
        
        // Homepage
        xml += '  <url>\n    <loc>https://newsreporter.live/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n';
        
        // Category pages
        for (const cat of categories) {
            xml += `  <url>\n    <loc>https://newsreporter.live/?category=${encodeURIComponent(cat.name.toLowerCase())}</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
        }
        
        // Static pages
        ['about', 'team', 'contact', 'privacy', 'terms'].forEach(page => {
            xml += `  <url>\n    <loc>https://newsreporter.live/${page}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
        });
        
        // Articles
        for (const a of articles) {
            const lastmod = a.updated_at || a.published_at || new Date().toISOString();
            xml += `  <url>\n    <loc>https://newsreporter.live/article/${a.slug}</loc>\n    <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n`;
            xml += `    <news:news>\n      <news:publication>\n        <news:name>News Reporter Live</news:name>\n        <news:language>en</news:language>\n      </news:publication>\n      <news:publication_date>${new Date(a.published_at || lastmod).toISOString()}</news:publication_date>\n    </news:news>\n`;
            xml += `  </url>\n`;
        }
        
        xml += '</urlset>';
        res.set('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send('Error generating sitemap');
    }
});

// ============================================================
// SEO: Robots.txt
// ============================================================
app.get('/robots.txt', (req, res) => {
    const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /portal
Disallow: /api/
Allow: /api/news
Allow: /api/news/

Sitemap: https://newsreporter.live/sitemap.xml

# Crawl-delay: 1
`;
    res.set('Content-Type', 'text/plain');
    res.send(robots);
});

// ============================================================
// SEO: Favicon SVG
// ============================================================
app.get('/favicon.svg', (req, res) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#D32F2F"/>
  <text x="32" y="28" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">NR</text>
  <rect x="12" y="40" width="40" height="3" rx="1.5" fill="rgba(255,255,255,0.9)"/>
  <text x="32" y="53" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="rgba(255,255,255,0.85)" text-anchor="middle" letter-spacing="2">LIVE</text>
</svg>`;
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=31536000');
    res.send(svg);
});

// ============================================================
// SEO: RSS Feed
// ============================================================
app.get('/rss', (req, res) => {
    try {
        const articles = db.prepare("SELECT title, slug, excerpt, author, category, published_at, image_url FROM cms_articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 50").all();
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n';
        xml += '<channel>\n';
        xml += '  <title>News Reporter Live</title>\n';
        xml += '  <link>https://newsreporter.live</link>\n';
        xml += '  <description>India\'s trusted digital news source for breaking news, politics, business, sports, technology, and entertainment.</description>\n';
        xml += '  <language>en-in</language>\n';
        xml += '  <atom:link href="https://newsreporter.live/rss" rel="self" type="application/rss+xml"/>\n';
        xml += `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
        xml += '  <image>\n    <url>https://newsreporter.live/logo.png</url>\n    <title>News Reporter Live</title>\n    <link>https://newsreporter.live</link>\n  </image>\n';
        for (const a of articles) {
            const authorInfo = getAuthorForCategory(a.category);
            xml += '  <item>\n';
            xml += `    <title><![CDATA[${a.title}]]></title>\n`;
            xml += `    <link>https://newsreporter.live/article/${a.slug}</link>\n`;
            xml += `    <guid isPermaLink="true">https://newsreporter.live/article/${a.slug}</guid>\n`;
            xml += `    <description><![CDATA[${a.excerpt || ''}]]></description>\n`;
            xml += `    <author>${a.author || authorInfo.name}</author>\n`;
            xml += `    <category>${a.category}</category>\n`;
            xml += `    <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>\n`;
            if (a.image_url) xml += `    <media:content url="${a.image_url}" medium="image"/>\n`;
            xml += '  </item>\n';
        }
        xml += '</channel>\n</rss>';
        res.set('Content-Type', 'application/rss+xml');
        res.send(xml);
    } catch (err) {
        res.status(500).send('Error generating RSS feed');
    }
});

// ============================================================
// SEO: Team/About/Privacy/Terms pages (server-rendered for SEO)
// ============================================================
app.get('/team', (req, res) => {
    const authors = Object.entries(CATEGORY_AUTHORS);
    // Deduplicate by name
    const seen = new Set();
    const unique = authors.filter(([cat, a]) => { if (seen.has(a.name)) return false; seen.add(a.name); return true; });
    
    let html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Our Team - News Reporter Live</title>
<meta name="description" content="Meet the journalists and editors behind News Reporter Live. Our team of experienced reporters brings you trusted news from across India.">
<meta name="google-site-verification" content="1hw_3Cw1LGE9omiJWHKJl1EuKDyd6V6zpaLxYhNNQn8">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="canonical" href="https://newsreporter.live/team">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans',sans-serif;background:#f5f5f5;color:#212121;margin:0;line-height:1.6}
.header{background:#fff;border-bottom:3px solid #D32F2F;padding:16px 20px;text-align:center}
.header h1{font-family:'Noto Serif',serif;font-size:28px;color:#D32F2F;margin-bottom:4px}
.main{max-width:1000px;margin:30px auto;padding:0 20px}
.team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px}
.member{background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:transform 0.2s}
.member:hover{transform:translateY(-4px);box-shadow:0 4px 16px rgba(0,0,0,0.12)}
.avatar{width:64px;height:64px;border-radius:50%;background:#D32F2F;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;margin-bottom:12px}
.member h3{font-size:18px;margin-bottom:4px} .member .title{color:#D32F2F;font-size:13px;font-weight:600;margin-bottom:4px}
.member .cats{font-size:12px;color:#9e9e9e;margin-bottom:8px}
.back{display:inline-block;margin-bottom:20px;color:#D32F2F;font-weight:600;text-decoration:none}</style></head><body>
<div class="header"><h1>News Reporter Live</h1><p style="color:#616161;font-size:14px">Our Editorial Team</p></div>
<div class="main"><a class="back" href="/">&larr; Back to News</a><h2 style="font-family:'Noto Serif',serif;margin-bottom:20px">Meet Our Journalists</h2>
<div class="team-grid">`;
    
    for (const [cat, a] of unique) {
        const initials = a.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        const cats = authors.filter(([c, au]) => au.name === a.name).map(([c]) => c).join(', ');
        const id = a.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-+$/, '');
        html += `<div class="member" id="${id}"><div class="avatar">${initials}</div><h3>${a.name}</h3><div class="title">${a.title}</div><div class="cats">Covers: ${cats}</div></div>`;
    }
    html += '</div></div></body></html>';
    res.send(html);
});

app.get('/about', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>About Us - News Reporter Live</title><meta name="description" content="News Reporter Live is India's trusted independent digital news organization delivering breaking news, in-depth analysis, and exclusive stories.">
<meta name="google-site-verification" content="1hw_3Cw1LGE9omiJWHKJl1EuKDyd6V6zpaLxYhNNQn8">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="canonical" href="https://newsreporter.live/about">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans',sans-serif;background:#f5f5f5;color:#212121;margin:0;line-height:1.8}
.header{background:#fff;border-bottom:3px solid #D32F2F;padding:16px 20px;text-align:center}
.header h1{font-family:'Noto Serif',serif;font-size:28px;color:#D32F2F}
.main{max-width:800px;margin:30px auto;padding:0 20px;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
h2{font-family:'Noto Serif',serif;color:#D32F2F;margin-top:24px}
.back{display:inline-block;margin-bottom:20px;color:#D32F2F;font-weight:600;text-decoration:none}</style></head><body>
<div class="header"><h1>News Reporter Live</h1></div>
<div class="main"><a class="back" href="/">&larr; Back to News</a>
<h2>About News Reporter Live</h2>
<p>News Reporter Live is India's trusted independent digital news organization, founded with the mission of delivering accurate, timely, and unbiased news to millions of readers across India and the world.</p>
<h2>Our Mission</h2>
<p>We believe in the power of journalism to inform, educate, and empower. Our dedicated team of reporters, editors, and analysts work around the clock to bring you breaking news, in-depth analysis, investigative reports, and exclusive stories across politics, business, sports, technology, entertainment, and more.</p>
<h2>Our Values</h2>
<p><strong>Accuracy:</strong> Every story is fact-checked and verified before publication.</p>
<p><strong>Independence:</strong> We maintain editorial independence and are not influenced by political or corporate interests.</p>
<p><strong>Transparency:</strong> We are committed to transparent journalism and always credit our sources.</p>
<h2>Contact Us</h2>
<p>For news tips, feedback, or collaborations, reach us at: <strong>editor@newsreporter.live</strong></p>
</div></body></html>`);
});

app.get('/privacy', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Privacy Policy - News Reporter Live</title><meta name="description" content="Privacy Policy for News Reporter Live - How we collect, use, and protect your personal information.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="canonical" href="https://newsreporter.live/privacy">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans',sans-serif;background:#f5f5f5;color:#212121;margin:0;line-height:1.8}
.header{background:#fff;border-bottom:3px solid #D32F2F;padding:16px 20px;text-align:center}
.header h1{font-family:'Noto Serif',serif;font-size:28px;color:#D32F2F}
.main{max-width:800px;margin:30px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
h2{font-family:'Noto Serif',serif;color:#333;margin-top:24px}
.back{display:inline-block;margin-bottom:20px;color:#D32F2F;font-weight:600;text-decoration:none}</style></head><body>
<div class="header"><h1>News Reporter Live</h1></div>
<div class="main"><a class="back" href="/">&larr; Back to News</a>
<h1>Privacy Policy</h1><p><em>Last updated: March 2026</em></p>
<h2>Information We Collect</h2><p>We collect information you voluntarily provide (name, email for newsletter/comments) and automatically collected data (IP address, browser type, pages visited) through cookies and analytics.</p>
<h2>How We Use Your Information</h2><p>To deliver news content, improve our services, send newsletters (with consent), moderate comments, and analyze site usage.</p>
<h2>Cookies</h2><p>We use essential cookies for site functionality and analytics cookies to understand readership patterns. You can disable cookies in your browser settings.</p>
<h2>Data Protection</h2><p>We implement appropriate security measures to protect your personal information. We do not sell your data to third parties.</p>
<h2>Your Rights</h2><p>You may request access to, correction of, or deletion of your personal data by contacting us at editor@newsreporter.live.</p>
</div></body></html>`);
});

app.get('/terms', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Terms of Service - News Reporter Live</title><meta name="description" content="Terms of Service for News Reporter Live.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="canonical" href="https://newsreporter.live/terms">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans',sans-serif;background:#f5f5f5;color:#212121;margin:0;line-height:1.8}
.header{background:#fff;border-bottom:3px solid #D32F2F;padding:16px 20px;text-align:center}
.header h1{font-family:'Noto Serif',serif;font-size:28px;color:#D32F2F}
.main{max-width:800px;margin:30px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
h2{font-family:'Noto Serif',serif;color:#333;margin-top:24px}
.back{display:inline-block;margin-bottom:20px;color:#D32F2F;font-weight:600;text-decoration:none}</style></head><body>
<div class="header"><h1>News Reporter Live</h1></div>
<div class="main"><a class="back" href="/">&larr; Back to News</a>
<h1>Terms of Service</h1><p><em>Last updated: March 2026</em></p>
<h2>Use of Content</h2><p>All content on News Reporter Live is protected by copyright. You may share articles with proper attribution but may not reproduce content without permission.</p>
<h2>Comments Policy</h2><p>Comments are moderated. We reserve the right to remove comments that are abusive, spam, or violate community guidelines.</p>
<h2>Disclaimer</h2><p>News Reporter Live strives for accuracy but does not guarantee the completeness of information. Views expressed in opinion articles are those of the authors.</p>
<h2>Contact</h2><p>For questions about these terms, contact us at editor@newsreporter.live.</p>
</div></body></html>`);
});

app.get('/contact', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contact Us - News Reporter Live</title><meta name="description" content="Contact News Reporter Live for news tips, feedback, advertising, and collaborations.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="canonical" href="https://newsreporter.live/contact">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Serif:wght@400;700&display=swap" rel="stylesheet">
<style>body{font-family:'Noto Sans',sans-serif;background:#f5f5f5;color:#212121;margin:0;line-height:1.8}
.header{background:#fff;border-bottom:3px solid #D32F2F;padding:16px 20px;text-align:center}
.header h1{font-family:'Noto Serif',serif;font-size:28px;color:#D32F2F}
.main{max-width:800px;margin:30px auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
h2{font-family:'Noto Serif',serif;color:#333;margin-top:24px}
.back{display:inline-block;margin-bottom:20px;color:#D32F2F;font-weight:600;text-decoration:none}</style></head><body>
<div class="header"><h1>News Reporter Live</h1></div>
<div class="main"><a class="back" href="/">&larr; Back to News</a>
<h1>Contact Us</h1>
<h2>Editorial</h2><p>For news tips, corrections, or feedback: <strong>editor@newsreporter.live</strong></p>
<h2>Advertising</h2><p>For advertising inquiries: <strong>ads@newsreporter.live</strong></p>
<h2>General</h2><p>For all other inquiries: <strong>info@newsreporter.live</strong></p>
</div></body></html>`);
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
            contents: [{ parts: [{ text: `${systemPrompt}\n\nTitle: ${title}\n\nOriginal Article:\n${content}\n\nProvide your response as JSON: {"title": "rewritten title", "content": "rewritten article HTML with <p> tags", "excerpt": "2-3 sentence summary", "meta_description": "SEO meta description", "meta_keywords": "comma separated keywords", "image_query": "short search term for thumbnail image"}` }] }]
        });
    } else if (provider === 'openrouter') {
        hostname = 'openrouter.ai';
        apiPath = '/api/v1/chat/completions';
        body = JSON.stringify({
            model: model || 'google/gemini-2.0-flash-001',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Title: ${title}\n\nOriginal Article:\n${content}\n\nProvide your response as JSON: {"title": "SEO optimized headline", "content": "full article HTML with <p> tags, 500-800 words", "excerpt": "compelling 2-3 sentence summary", "meta_description": "SEO meta description under 160 chars", "meta_keywords": "comma separated SEO keywords", "image_query": "2-3 word search term for a relevant thumbnail photo"}` }
            ],
            temperature: 0.8
        });
    } else {
        // OpenAI compatible (works with OpenAI, Groq, Together, etc)
        hostname = provider === 'groq' ? 'api.groq.com' : provider === 'together' ? 'api.together.xyz' : 'api.openai.com';
        apiPath = provider === 'groq' ? '/openai/v1/chat/completions' : '/v1/chat/completions';
        body = JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Title: ${title}\n\nOriginal Article:\n${content}\n\nProvide your response as JSON: {"title": "rewritten title", "content": "rewritten article HTML with <p> tags", "excerpt": "2-3 sentence summary", "meta_description": "SEO meta description", "meta_keywords": "comma separated keywords", "image_query": "short search term for thumbnail image"}` }
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
                ...(provider !== 'gemini' && provider !== 'google' ? { 'Authorization': `Bearer ${apiKey}` } : {}),
                ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://newsreporter.live', 'X-Title': 'News Reporter Live' } : {})
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
                    if (!text) return reject(new Error('No response from AI: ' + data.substring(0, 500)));
                    // Strip markdown code block wrappers if present
                    let cleanText = text.trim();
                    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
                    // Try to parse as JSON
                    try {
                        const jsonStart = cleanText.indexOf('{');
                        const jsonEnd = cleanText.lastIndexOf('}') + 1;
                        if (jsonStart === -1 || jsonEnd <= jsonStart) throw new Error('No JSON object found');
                        const result = JSON.parse(cleanText.substring(jsonStart, jsonEnd));
                        // Validate required fields
                        if (!result.title || !result.content) throw new Error('Missing title or content in JSON');
                        // Clean up content - fix literal \n\n and escaped quotes
                        result.content = result.content.replace(/\\n\\n/g, '</p><p>').replace(/\\n/g, ' ').replace(/\\"/g, '"');
                        resolve(result);
                    } catch (jsonErr) {
                        // Fallback: extract a clean title from the content, not the prompt
                        const firstLine = text.replace(/<[^>]+>/g, '').trim().split(/[.!?\n]/)[0].trim();
                        const fallbackTitle = firstLine.length > 10 && firstLine.length < 200 ? firstLine : 'Breaking News Update';
                        const fallbackContent = text.replace(/\\n\\n/g, '</p><p>').replace(/\\n/g, ' ');
                        console.error('AI JSON parse failed:', jsonErr.message, '| Using fallback title:', fallbackTitle);
                        resolve({ title: fallbackTitle, content: fallbackContent, excerpt: fallbackContent.replace(/<[^>]+>/g, '').substring(0, 200), meta_description: fallbackContent.replace(/<[^>]+>/g, '').substring(0, 160) });
                    }
                } catch (e) {
                    reject(new Error('Failed to parse AI response: ' + e.message + ' | Raw: ' + data.substring(0, 300)));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('AI request timeout')); });
        req.setTimeout(60000);
        req.write(body);
        req.end();
    });
}

// Search for a relevant thumbnail image - uses diverse Unsplash images per category
function searchUnsplashImage(query) {
    const https = require('https');
    const searchQuery = encodeURIComponent(query);
    // Multiple curated images per category for visual diversity
    const categoryImagePool = {
        'politics': [
            'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
            'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=80',
            'https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80',
            'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80',
            'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&q=80',
            'https://images.unsplash.com/photo-1604580864964-0462f5d5b1a8?w=800&q=80',
            'https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800&q=80',
            'https://images.unsplash.com/photo-1575320181282-9afab399332c?w=800&q=80'
        ],
        'business': [
            'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
            'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80',
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',
            'https://images.unsplash.com/photo-1444653614773-995cb1ef9efa?w=800&q=80',
            'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
            'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80'
        ],
        'sports': [
            'https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b?w=800&q=80',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
            'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80',
            'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80',
            'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=800&q=80',
            'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80',
            'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
            'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&q=80'
        ],
        'technology': [
            'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
            'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',
            'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80',
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
            'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
            'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&q=80',
            'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80',
            'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80'
        ],
        'entertainment': [
            'https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&q=80',
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
            'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
            'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80',
            'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&q=80',
            'https://images.unsplash.com/photo-1485095329183-d0797cdc5676?w=800&q=80',
            'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=800&q=80',
            'https://images.unsplash.com/photo-1499364615650-ec38552f4f34?w=800&q=80'
        ],
        'world': [
            'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&q=80',
            'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80',
            'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?w=800&q=80',
            'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80',
            'https://images.unsplash.com/photo-1503945438517-f65904a52ce6?w=800&q=80',
            'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80',
            'https://images.unsplash.com/photo-1589519160732-57fc498494f8?w=800&q=80',
            'https://images.unsplash.com/photo-1478860409698-8707f313ee8b?w=800&q=80'
        ],
        'health': [
            'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80',
            'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
            'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80',
            'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80',
            'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&q=80',
            'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
            'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&q=80',
            'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'
        ],
        'science': [
            'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
            'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80',
            'https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=800&q=80',
            'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80',
            'https://images.unsplash.com/photo-1564053489984-317bbd824340?w=800&q=80',
            'https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=800&q=80',
            'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
            'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&q=80'
        ],
        'opinion': [
            'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&q=80',
            'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=800&q=80',
            'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80',
            'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80',
            'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=800&q=80',
            'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=800&q=80',
            'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&q=80',
            'https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=800&q=80'
        ],
        'war': [
            'https://images.unsplash.com/photo-1580752300992-559f8e0734e0?w=800&q=80',
            'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=80',
            'https://images.unsplash.com/photo-1510034696085-597d716bd162?w=800&q=80',
            'https://images.unsplash.com/photo-1569242840510-9fe6f0112cee?w=800&q=80',
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80',
            'https://images.unsplash.com/photo-1579912437766-7896df6d3cd3?w=800&q=80',
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80',
            'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=800&q=80'
        ],
        'education': [
            'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
            'https://images.unsplash.com/photo-1523050854058-8df90110c8f1?w=800&q=80',
            'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&q=80',
            'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80',
            'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&q=80',
            'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80',
            'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80',
            'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80'
        ],
        'jobs': [
            'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
            'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',
            'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&q=80',
            'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80',
            'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80',
            'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80'
        ],
        'cricket': [
            'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80',
            'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
            'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&q=80',
            'https://images.unsplash.com/photo-1587385789097-0197a7fbd179?w=800&q=80',
            'https://images.unsplash.com/photo-1580928684070-0a93f0de4c2b?w=800&q=80',
            'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
            'https://images.unsplash.com/photo-1594470117722-de4b9a02ebed?w=800&q=80',
            'https://images.unsplash.com/photo-1631194758628-71ec7c35137e?w=800&q=80'
        ],
        'ipl': [
            'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
            'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80',
            'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&q=80',
            'https://images.unsplash.com/photo-1580928684070-0a93f0de4c2b?w=800&q=80',
            'https://images.unsplash.com/photo-1587385789097-0197a7fbd179?w=800&q=80',
            'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
            'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
            'https://images.unsplash.com/photo-1594470117722-de4b9a02ebed?w=800&q=80'
        ],
        'gadget reviews': [
            'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80',
            'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
            'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
            'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
            'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=800&q=80',
            'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',
            'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80'
        ],
        'gadget': [
            'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80',
            'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
            'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
            'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80'
        ]
    };
    // Pick a random image from the category pool
    const lowerQuery = query.toLowerCase();
    for (const [cat, urls] of Object.entries(categoryImagePool)) {
        if (lowerQuery.includes(cat)) {
            return Promise.resolve(urls[Math.floor(Math.random() * urls.length)]);
        }
    }
    return new Promise((resolve) => {
        // Use Pixabay API for image search (free tier, 100 req/min)
        const pixabayKey = '47491065-46b05a2fdb33adeb3e8d1728f';
        https.get(`https://pixabay.com/api/?key=${pixabayKey}&q=${searchQuery}&image_type=photo&per_page=8&safesearch=true`, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.hits && result.hits.length > 0) {
                        // Pick a random result from the top 8 for variety
                        const randomIdx = Math.floor(Math.random() * result.hits.length);
                        resolve(result.hits[randomIdx].webformatURL);
                    } else {
                        const worldImages = categoryImagePool['world'];
                        resolve(worldImages[Math.floor(Math.random() * worldImages.length)]);
                    }
                } catch {
                    const worldImages = categoryImagePool['world'];
                    resolve(worldImages[Math.floor(Math.random() * worldImages.length)]);
                }
            });
        }).on('error', () => {
            const worldImages = categoryImagePool['world'];
            resolve(worldImages[Math.floor(Math.random() * worldImages.length)]);
        });
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

// ============================================================
// Auto AI Article Generation Timer
// ============================================================
let aiAutoPublishTimer = null;
function startAIAutoPublishTimer() {
    if (aiAutoPublishTimer) clearInterval(aiAutoPublishTimer);
    const settings = {};
    try {
        db.prepare('SELECT * FROM cms_settings').all().forEach(r => settings[r.key] = r.value);
    } catch(e) {}
    
    const autoPublish = settings.auto_publish === 'true' || settings.auto_publish === '1';
    const intervalMinutes = parseInt(settings.auto_publish_interval) || 60;
    
    if (!autoPublish) {
        console.log('AI auto-publish is disabled');
        return;
    }
    
    const apiKey = settings.ai_api_key || settings.openrouter_api_key;
    if (!apiKey) {
        console.log('AI auto-publish: No API key configured');
        return;
    }
    
    console.log(`AI auto-publish enabled: 1 article per category every ${intervalMinutes} minutes`);
    
    // Run immediately on startup, then every interval
    async function autoGenerateArticles() {
        try {
            // Re-read settings each time in case they changed
            const currentSettings = {};
            db.prepare('SELECT * FROM cms_settings').all().forEach(r => currentSettings[r.key] = r.value);
            
            const isEnabled = currentSettings.auto_publish === 'true' || currentSettings.auto_publish === '1';
            if (!isEnabled) { console.log('AI auto-publish: disabled, skipping'); return; }
            
            const key = currentSettings.ai_api_key || currentSettings.openrouter_api_key;
            if (!key) { console.log('AI auto-publish: no API key, skipping'); return; }
            
            const provider = currentSettings.ai_provider || 'openrouter';
            const model = currentSettings.ai_model || 'google/gemini-2.0-flash-001';
            
            const categories = db.prepare('SELECT * FROM cms_categories ORDER BY sort_order').all();
            if (categories.length === 0) { console.log('AI auto-publish: no categories'); return; }
            
            const topicIdeas = {
                'Politics': ['government policy reform', 'election campaign updates', 'parliament session highlights', 'state politics developments', 'political alliance shifts'],
                'Business': ['stock market analysis', 'startup funding news', 'corporate earnings report', 'economic growth indicators', 'trade policy impact'],
                'Sports': ['cricket match highlights', 'football league updates', 'Olympic athlete training', 'tennis tournament results', 'sports team transfer news'],
                'Technology': ['AI innovation breakthrough', 'smartphone launch review', 'cybersecurity threat alert', 'space technology mission', 'electric vehicle advancement'],
                'Entertainment': ['Bollywood movie release', 'OTT platform new series', 'music album launch', 'celebrity interview highlights', 'film festival awards'],
                'World': ['international diplomacy summit', 'global climate change action', 'UN peacekeeping mission', 'world economy forecast', 'international trade agreement'],
                'Health': ['public health initiative', 'medical research breakthrough', 'mental health awareness campaign', 'nutrition and wellness trends', 'hospital infrastructure development'],
                'Science': ['space exploration discovery', 'quantum computing progress', 'genetic research milestone', 'environmental science study', 'archaeological finding revealed'],
                'Opinion': ['editorial on education reform', 'opinion on digital privacy', 'analysis of foreign policy', 'commentary on social media impact', 'perspective on urban development'],
                'War': ['India border security update', 'military defense technology upgrade', 'geopolitical conflict analysis', 'armed forces modernization', 'peacekeeping operations report'],
                'Education': ['CBSE board exam reform', 'IIT JEE preparation tips', 'NEP 2020 implementation update', 'university ranking changes', 'scholarship and fellowship announcements'],
                'Jobs': ['government job recruitment notification', 'IT sector hiring trends', 'startup job market analysis', 'UPSC exam preparation guide', 'skill development initiative launched'],
                'Cricket': ['India vs Pakistan match analysis', 'Test cricket series highlights', 'women cricket team performance', 'domestic cricket tournament update', 'cricket player injury and fitness news'],
                'IPL': ['IPL team auction strategy', 'IPL match day highlights and scores', 'IPL player performance review', 'IPL franchise business analysis', 'IPL emerging players to watch'],
                'Gadget Reviews': ['latest smartphone review and comparison', 'laptop buying guide for students', 'smartwatch and wearable tech review', 'budget gadget recommendations India', 'upcoming gadget launches in India']
            };
            
            const seoPrompt = `You are a senior investigative reporter at News Reporter Live, India's trusted digital news source. Write an ORIGINAL, exclusive news article about the given topic. 

CRITICAL RULES:
1. Write in first-person reporter style with natural, conversational Indian English
2. Use the inverted pyramid structure: most important facts first
3. Include realistic quotes from unnamed sources (e.g., "A senior official told News Reporter Live...")
4. SEO OPTIMIZATION: Use the main keyword in the title, first paragraph, one subheading, and naturally 3-4 times throughout
5. Include 2-3 subheadings using <h3> tags for SEO
6. Write 500-800 words in multiple <p> paragraphs
7. Include the exact word "reportersays" naturally ONCE in the middle of the article (e.g., "as reportersays from the ground...")
8. Make it sound like a REAL reporter wrote this - use location details, time references, and specific details
9. DO NOT use phrases like "In conclusion", "Furthermore", "It is worth noting" - these sound robotic
10. Add a compelling, click-worthy headline that includes the main keyword

IMPORTANT: Respond ONLY with raw JSON. Do NOT wrap in markdown code blocks. No \`\`\`json or \`\`\`. Just the raw JSON object starting with { and ending with }.`;

            let totalGenerated = 0;
            console.log(`AI auto-publish: generating 1 article per category (${categories.length} categories)...`);
            
            for (const cat of categories) {
                try {
                    const topics = topicIdeas[cat.name] || [`latest ${cat.name.toLowerCase()} news in India`, `breaking ${cat.name.toLowerCase()} update today`];
                    const chosenTopic = topics[Math.floor(Math.random() * topics.length)];
                    const dateContext = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    
                    const result = await callAI(provider, key, model, seoPrompt,
                        `Write an original ${cat.name} news article about: ${chosenTopic}`,
                        `Category: ${cat.name}\nTopic: ${chosenTopic}\nDate: ${dateContext}\nPublication: News Reporter Live\n\nWrite a fresh, original article about this topic as if reporting live from India today.`
                    );
                    
                    if (result && result.title && result.content) {
                        let imageUrl = '';
                        try {
                            imageUrl = await searchUnsplashImage(cat.name.toLowerCase() + ' ' + (result.image_query || chosenTopic));
                        } catch (imgErr) {
                            imageUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=800&q=80';
                        }
                        
                        const slug = generateSlug(result.title);
                        const excerpt = result.excerpt || result.content.replace(/<[^>]+>/g, '').substring(0, 200);
                        const metaDesc = result.meta_description || excerpt.substring(0, 160);
                        
                        const catAuthor = getAuthorForCategory(cat.name);
                        db.prepare(`
                            INSERT INTO cms_articles (title, slug, excerpt, content, category, image_url, author, status, source_url, ai_generated, published_at, meta_description)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, 1, ?, ?)
                        `).run(result.title, slug, excerpt, result.content, cat.name, imageUrl, catAuthor.name, 'ai-auto-generated', new Date().toISOString(), metaDesc);
                        
                        db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status) VALUES (?, ?, ?)').run('ai-auto-generated', result.title, 'auto-published');
                        totalGenerated++;
                        console.log(`AI auto-publish: "${result.title}" by ${catAuthor.name} in ${cat.name}`);
                    }
                } catch (genErr) {
                    console.error(`AI auto-publish error (${cat.name}):`, genErr.message);
                    db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status, error_message) VALUES (?, ?, ?, ?)').run('ai-auto-generate', cat.name, 'error', genErr.message);
                }
                
                // Delay between categories to avoid rate limiting
                await new Promise(r => setTimeout(r, 3000));
            }
            
            console.log(`AI auto-publish complete: ${totalGenerated} articles generated`);
        } catch (err) {
            console.error('AI auto-publish timer error:', err.message);
        }
    }
    
    // Run first batch 30 seconds after startup
    setTimeout(autoGenerateArticles, 30000);
    
    // Then run every interval
    aiAutoPublishTimer = setInterval(autoGenerateArticles, intervalMinutes * 60 * 1000);
}
startAIAutoPublishTimer();

// ============================================================
// Cricket Live Score API (CricBuzz via RapidAPI)
// ============================================================
const CRICBUZZ_API_KEY = '20bb5c7d6emshe09a76fff2d42b3p187df4jsn96b12af13cf6';
const CRICBUZZ_HOST = 'cricbuzz-cricket.p.rapidapi.com';

// In-memory cache for cricket API responses (to avoid hitting rate limits)
const cricketCache = new Map();
const CRICKET_CACHE_TTL = 60 * 1000; // 60 seconds cache

function getCricketCache(key) {
    const entry = cricketCache.get(key);
    if (entry && Date.now() - entry.timestamp < CRICKET_CACHE_TTL) return entry.data;
    return null;
}

function setCricketCache(key, data) {
    cricketCache.set(key, { data, timestamp: Date.now() });
}

async function fetchCricBuzz(endpoint) {
    const cached = getCricketCache(endpoint);
    if (cached) return cached;

    const https = require('https');
    return new Promise((resolve, reject) => {
        const options = {
            hostname: CRICBUZZ_HOST,
            path: endpoint,
            method: 'GET',
            headers: {
                'x-rapidapi-key': CRICBUZZ_API_KEY,
                'x-rapidapi-host': CRICBUZZ_HOST
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    setCricketCache(endpoint, parsed);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Failed to parse CricBuzz response'));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('CricBuzz API timeout')); });
        req.end();
    });
}

// Get current matches (live + recent + upcoming)
app.get('/api/cricket/matches/current', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/matches/v1/current');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch cricket matches' });
    }
});

// Get live matches only
app.get('/api/cricket/matches/live', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/matches/v1/live');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch live matches' });
    }
});

// Get recent matches
app.get('/api/cricket/matches/recent', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/matches/v1/recent');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch recent matches' });
    }
});

// Get upcoming matches
app.get('/api/cricket/matches/upcoming', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/matches/v1/upcoming');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch upcoming matches' });
    }
});

// Get match scorecard
app.get('/api/cricket/match/:matchId/scorecard', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/mcenter/v1/${req.params.matchId}/scard`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch scorecard' });
    }
});

// Get match info/details
app.get('/api/cricket/match/:matchId/info', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/mcenter/v1/${req.params.matchId}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch match info' });
    }
});

// Get match commentary
app.get('/api/cricket/match/:matchId/commentary', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/mcenter/v1/${req.params.matchId}/comm`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch commentary' });
    }
});

// Get match overs / leanback (mini scorecard)
app.get('/api/cricket/match/:matchId/overs', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/mcenter/v1/${req.params.matchId}/overs`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch overs' });
    }
});

// ============================================================
// Rankings API
// ============================================================
// Batsmen rankings (formatType: test, odi, t20i)
app.get('/api/cricket/rankings/batsmen', async (req, res) => {
    try {
        const format = req.query.formatType || 'test';
        const data = await fetchCricBuzz(`/stats/v1/rankings/batsmen?formatType=${format}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch batsmen rankings' });
    }
});

// Bowlers rankings
app.get('/api/cricket/rankings/bowlers', async (req, res) => {
    try {
        const format = req.query.formatType || 'test';
        const data = await fetchCricBuzz(`/stats/v1/rankings/bowlers?formatType=${format}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch bowlers rankings' });
    }
});

// All-rounders rankings
app.get('/api/cricket/rankings/allrounders', async (req, res) => {
    try {
        const format = req.query.formatType || 'test';
        const data = await fetchCricBuzz(`/stats/v1/rankings/allrounders?formatType=${format}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch allrounders rankings' });
    }
});

// Team rankings
app.get('/api/cricket/rankings/teams', async (req, res) => {
    try {
        const format = req.query.formatType || 'test';
        const data = await fetchCricBuzz(`/stats/v1/rankings/teams?formatType=${format}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch team rankings' });
    }
});

// ============================================================
// Player API
// ============================================================
app.get('/api/cricket/player/:playerId', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/stats/v1/player/${req.params.playerId}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch player info' });
    }
});

// Player batting stats
app.get('/api/cricket/player/:playerId/batting', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/stats/v1/player/${req.params.playerId}/batting`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch player batting stats' });
    }
});

// Player bowling stats
app.get('/api/cricket/player/:playerId/bowling', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/stats/v1/player/${req.params.playerId}/bowling`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch player bowling stats' });
    }
});

// AI-enhanced commentary endpoint
app.post('/api/cricket/ai-commentary', async (req, res) => {
    try {
        const { matchInfo, commentaryData } = req.body;
        if (!matchInfo) return res.status(400).json({ success: false, message: 'matchInfo required' });
        const prompt = `You are a professional cricket commentator. Based on this match info, provide detailed ball-by-ball commentary analysis.\nMatch: ${matchInfo.team1 || 'Team 1'} vs ${matchInfo.team2 || 'Team 2'}\nFormat: ${matchInfo.format || 'Unknown'}\nVenue: ${matchInfo.venue || 'Unknown'}\n\nExisting commentary entries: ${JSON.stringify((commentaryData || []).slice(0, 10))}\n\nProvide 15 additional detailed commentary entries in JSON array format. Each entry should have: overNum (number like 5.3), commText (detailed commentary text), event (one of: FOUR, SIX, WICKET, NONE, DOT). Make it realistic and engaging. Return ONLY a JSON array.`;
        const aiResult = await callAI(prompt, 'openrouter');
        let entries = [];
        try {
            const cleaned = aiResult.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
            entries = JSON.parse(cleaned);
        } catch(pe) { entries = []; }
        res.json({ success: true, data: entries });
    } catch (e) {
        console.error('AI commentary error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to generate AI commentary' });
    }
});

// Series squad detail (individual team squad)
app.get('/api/cricket/series/:seriesId/squads/:teamId', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/series/v1/${req.params.seriesId}/squads/${req.params.teamId}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch squad details' });
    }
});

// Series stats types
app.get('/api/cricket/stats/series/:seriesId', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/stats/v1/series/${req.params.seriesId}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch series stats' });
    }
});

// ============================================================
// Teams API
// ============================================================
// International teams listing
app.get('/api/cricket/teams/international', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/teams/v1/international');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch teams' });
    }
});

// Team players
app.get('/api/cricket/teams/:teamId/players', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/teams/v1/${req.params.teamId}/players`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch team players' });
    }
});

// Team schedule
app.get('/api/cricket/teams/:teamId/schedule', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/teams/v1/${req.params.teamId}/schedule`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch team schedule' });
    }
});

// ============================================================
// Series API
// ============================================================
app.get('/api/cricket/series/international', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/series/v1/international');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch series' });
    }
});

// ============================================================
// News API
// ============================================================
app.get('/api/cricket/news', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/news/v1/index');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch cricket news' });
    }
});

// ============================================================
// Photos API
// ============================================================
app.get('/api/cricket/photos', async (req, res) => {
    try {
        const data = await fetchCricBuzz('/photos/v1/index');
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch photos' });
    }
});

// Photo gallery detail
app.get('/api/cricket/photos/:galleryId', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/photos/v1/detail/${req.params.galleryId}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch photo gallery' });
    }
});

// ============================================================
// Series Detail API (matches, squads, venues, points table)
// ============================================================
// Series matches/details
app.get('/api/cricket/series/:seriesId', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/series/v1/${req.params.seriesId}`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch series details' });
    }
});

// Series squads list
app.get('/api/cricket/series/:seriesId/squads', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/series/v1/${req.params.seriesId}/squads`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch series squads' });
    }
});

// Series venues
app.get('/api/cricket/series/:seriesId/venues', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/series/v1/${req.params.seriesId}/venues`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch series venues' });
    }
});

// Series points table
app.get('/api/cricket/series/:seriesId/points-table', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/stats/v1/series/${req.params.seriesId}/points-table`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch points table' });
    }
});

// ============================================================
// Match Center API (leanback for live mini scorecard)
// ============================================================
app.get('/api/cricket/match/:matchId/leanback', async (req, res) => {
    try {
        const data = await fetchCricBuzz(`/mcenter/v1/${req.params.matchId}/leanback`);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Cricket API error:', e.message);
        res.status(500).json({ success: false, message: 'Failed to fetch leanback data' });
    }
});

// ============================================================
// Image proxy (serves CricBuzz images through our server)
// ============================================================
app.get('/api/cricket/img/:imageId', (req, res) => {
    const imageId = req.params.imageId;
    const cacheKey = `img_${imageId}`;
    const cachedBuf = getCricketCache(cacheKey);
    if (cachedBuf) {
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(cachedBuf);
    }
    const https = require('https');
    const options = {
        hostname: CRICBUZZ_HOST,
        path: `/img/v1/i1/c${imageId}/i.jpg`,
        method: 'GET',
        headers: {
            'x-rapidapi-key': CRICBUZZ_API_KEY,
            'x-rapidapi-host': CRICBUZZ_HOST
        }
    };
    const proxyReq = https.request(options, (proxyRes) => {
        const chunks = [];
        proxyRes.on('data', chunk => chunks.push(chunk));
        proxyRes.on('end', () => {
            const buf = Buffer.concat(chunks);
            setCricketCache(cacheKey, buf);
            res.set('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=86400');
            res.send(buf);
        });
    });
    proxyReq.on('error', () => {
        res.status(500).send('Failed to load image');
    });
    proxyReq.setTimeout(10000, () => { proxyReq.destroy(); res.status(500).send('Image timeout'); });
    proxyReq.end();
});

// Serve cricket live page
app.get('/cricket-live', (req, res) => {
    const cricketPage = path.join(DASHBOARD_DIR, 'newssite', 'cricket-live.html');
    if (fs.existsSync(cricketPage)) {
        res.sendFile(cricketPage);
    } else {
        res.status(404).send('Cricket Live page not found');
    }
});

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
