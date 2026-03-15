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
        const total = status ? db.prepare('SELECT COUNT(*) as c FROM cms_articles WHERE status = ?').get(status) : db.prepare('SELECT COUNT(*) as c FROM cms_articles').get();
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

// --- AI Generate Articles Across All Categories ---
app.post('/api/cms/ai-generate', async (req, res) => {
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

                        db.prepare(`
                            INSERT INTO cms_articles (title, slug, excerpt, content, category, image_url, author, status, source_url, ai_generated, published_at, meta_description)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, 1, ?, ?)
                        `).run(result.title, slug, excerpt, result.content, cat.name, imageUrl, 'News Reporter Live', 'ai-generated', new Date().toISOString(), metaDesc);

                        db.prepare('INSERT INTO cms_ai_log (source_url, source_title, status) VALUES (?, ?, ?)').run('ai-generated', result.title, 'auto-published');
                        totalGenerated++;
                        console.log(`Generated article: "${result.title}" in ${cat.name}`);
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
                    if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
                    else if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
                    if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
                    cleanText = cleanText.trim();
                    // Try to parse as JSON
                    try {
                        const jsonStart = cleanText.indexOf('{');
                        const jsonEnd = cleanText.lastIndexOf('}') + 1;
                        const result = JSON.parse(cleanText.substring(jsonStart, jsonEnd));
                        resolve(result);
                    } catch {
                        resolve({ title: title, content: text, excerpt: text.substring(0, 200), meta_description: text.substring(0, 160) });
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

// Search for a relevant thumbnail image using Pixabay API (free, no auth needed for limited use)
function searchUnsplashImage(query) {
    const https = require('https');
    const searchQuery = encodeURIComponent(query);
    // Category-based curated image fallbacks
    const categoryImages = {
        'politics': 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&q=80',
        'business': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80',
        'sports': 'https://images.unsplash.com/photo-1461896836934-bd45ba8fcf9b?w=800&q=80',
        'technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
        'entertainment': 'https://images.unsplash.com/photo-1603190287605-e6ade32fa852?w=800&q=80',
        'world': 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&q=80',
        'health': 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80',
        'science': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80',
        'opinion': 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&q=80',
        'war': 'https://images.unsplash.com/photo-1580752300992-559f8e0734e0?w=800&q=80',
        'education': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
        'jobs': 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',
        'cricket': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80',
        'ipl': 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80',
        'gadget reviews': 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80',
        'gadget': 'https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80'
    };
    // Try to match a category from the query
    const lowerQuery = query.toLowerCase();
    for (const [cat, url] of Object.entries(categoryImages)) {
        if (lowerQuery.includes(cat)) return Promise.resolve(url);
    }
    return new Promise((resolve) => {
        // Use Pixabay API for image search (free tier, 100 req/min)
        const pixabayKey = '47491065-46b05a2fdb33adeb3e8d1728f';
        https.get(`https://pixabay.com/api/?key=${pixabayKey}&q=${searchQuery}&image_type=photo&per_page=3&safesearch=true`, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.hits && result.hits.length > 0) {
                        resolve(result.hits[0].webformatURL);
                    } else {
                        resolve(categoryImages['world']);
                    }
                } catch {
                    resolve(categoryImages['world']);
                }
            });
        }).on('error', () => {
            resolve(categoryImages['world']);
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
