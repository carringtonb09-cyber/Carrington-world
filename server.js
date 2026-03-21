const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ANALYTICS_FILE = path.join(__dirname, 'analytics-data.json');
const DASHBOARD_KEY = process.env.DASH_KEY || 'buckets2026';

// ── Initialize analytics data ──
function loadAnalytics() {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        totalPageViews: 0,
        uniqueVisitors: new Set(),
        dailyViews: {},
        sectionViews: {},
        buttonClicks: {},
        formSubmissions: { contact: 0, beatSubmission: 0 },
        referrers: {},
        devices: { mobile: 0, desktop: 0, tablet: 0 },
        topPages: {},
        hourlyTraffic: {},
        visitorIPs: []
    };
}

function saveAnalytics(data) {
    const toSave = {
        ...data,
        uniqueVisitors: [...(data.uniqueVisitors instanceof Set ? data.uniqueVisitors : new Set(data.uniqueVisitors || []))]
    };
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(toSave, null, 2));
}

let analytics = loadAnalytics();
if (Array.isArray(analytics.uniqueVisitors)) {
    analytics.uniqueVisitors = new Set(analytics.uniqueVisitors);
} else if (!(analytics.uniqueVisitors instanceof Set)) {
    analytics.uniqueVisitors = new Set();
}

// Auto-save every 30 seconds
setInterval(() => saveAnalytics(analytics), 30000);

// ── Helpers ──
function getToday() {
    return new Date().toISOString().split('T')[0];
}

function getHour() {
    return new Date().getHours().toString();
}

function getDeviceType(ua) {
    if (!ua) return 'desktop';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    if (/mobile|iphone|android.*mobile/i.test(ua)) return 'mobile';
    return 'desktop';
}

function getVisitorId(req) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    return `${ip}_${ua.slice(0, 50)}`;
}

// ── Security headers ──
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(express.json());

// ── Track page views ──
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        const today = getToday();
        const hour = getHour();
        const visitorId = getVisitorId(req);
        const device = getDeviceType(req.headers['user-agent']);
        const referrer = req.headers['referer'] || req.headers['referrer'] || 'direct';

        analytics.totalPageViews++;
        analytics.uniqueVisitors.add(visitorId);
        analytics.dailyViews[today] = (analytics.dailyViews[today] || 0) + 1;
        analytics.devices[device] = (analytics.devices[device] || 0) + 1;
        analytics.hourlyTraffic[hour] = (analytics.hourlyTraffic[hour] || 0) + 1;

        // Track referrer domain
        try {
            const refDomain = new URL(referrer).hostname || 'direct';
            analytics.referrers[refDomain] = (analytics.referrers[refDomain] || 0) + 1;
        } catch {
            analytics.referrers['direct'] = (analytics.referrers['direct'] || 0) + 1;
        }
    }
    next();
});

// ── Analytics API: track events from client ──
app.post('/api/track', (req, res) => {
    const { event, data } = req.body || {};
    if (!event) return res.status(400).json({ error: 'Missing event' });

    const today = getToday();

    switch (event) {
        case 'section_view':
            if (data?.section) {
                if (!analytics.sectionViews[data.section]) analytics.sectionViews[data.section] = {};
                analytics.sectionViews[data.section][today] = (analytics.sectionViews[data.section][today] || 0) + 1;
            }
            break;
        case 'button_click':
            if (data?.button) {
                if (!analytics.buttonClicks[data.button]) analytics.buttonClicks[data.button] = {};
                analytics.buttonClicks[data.button][today] = (analytics.buttonClicks[data.button][today] || 0) + 1;
            }
            break;
        case 'form_submit':
            if (data?.form === 'contact') analytics.formSubmissions.contact++;
            if (data?.form === 'beat_submission') analytics.formSubmissions.beatSubmission++;
            break;
        case 'social_click':
            if (data?.platform) {
                if (!analytics.buttonClicks['social_' + data.platform]) analytics.buttonClicks['social_' + data.platform] = {};
                analytics.buttonClicks['social_' + data.platform][today] = (analytics.buttonClicks['social_' + data.platform][today] || 0) + 1;
            }
            break;
    }
    res.json({ ok: true });
});

// ── Analytics Dashboard ──
app.get('/dashboard', (req, res) => {
    if (req.query.key !== DASHBOARD_KEY) {
        return res.status(401).send('<h1>Access Denied</h1><p>Add ?key=YOUR_KEY to the URL</p>');
    }

    const today = getToday();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const last7 = [];
    const last30 = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        if (i < 7) last7.push(d);
        last30.push(d);
    }

    const viewsToday = analytics.dailyViews[today] || 0;
    const viewsYesterday = analytics.dailyViews[yesterday] || 0;
    const views7d = last7.reduce((sum, d) => sum + (analytics.dailyViews[d] || 0), 0);
    const views30d = last30.reduce((sum, d) => sum + (analytics.dailyViews[d] || 0), 0);

    // Section engagement
    const sectionTotals = {};
    for (const [section, days] of Object.entries(analytics.sectionViews || {})) {
        sectionTotals[section] = Object.values(days).reduce((a, b) => a + b, 0);
    }
    const sortedSections = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);

    // Button clicks
    const clickTotals = {};
    for (const [btn, days] of Object.entries(analytics.buttonClicks || {})) {
        clickTotals[btn] = Object.values(days).reduce((a, b) => a + b, 0);
    }
    const sortedClicks = Object.entries(clickTotals).sort((a, b) => b[1] - a[1]);

    // Referrers
    const sortedReferrers = Object.entries(analytics.referrers || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Chart data (last 14 days)
    const chartDays = [];
    const chartValues = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
        chartDays.push(d.slice(5)); // MM-DD
        chartValues.push(analytics.dailyViews[d] || 0);
    }

    res.send(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CB Analytics Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:32px}
h1{font-size:28px;margin-bottom:8px;color:#c8a44e}
.subtitle{color:#888;font-size:14px;margin-bottom:40px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:40px}
.card{background:#141414;border:1px solid rgba(255,255,255,0.06);padding:24px;text-align:center}
.card-number{font-size:36px;font-weight:700;color:#c8a44e;margin-bottom:4px}
.card-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888}
.section-title{font-size:18px;font-weight:600;margin:40px 0 16px;color:#c8a44e;letter-spacing:1px;text-transform:uppercase;font-size:12px}
table{width:100%;border-collapse:collapse;margin-bottom:32px}
td,th{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px}
th{color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase}
.bar{height:20px;background:linear-gradient(90deg,#c8a44e,#a08030);border-radius:2px;min-width:4px}
.chart{background:#141414;border:1px solid rgba(255,255,255,0.06);padding:24px;margin-bottom:32px;height:200px;display:flex;align-items:flex-end;gap:8px}
.chart-bar{flex:1;background:linear-gradient(to top,#a08030,#c8a44e);border-radius:2px 2px 0 0;position:relative;min-height:4px}
.chart-bar span{position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;color:#888}
.chart-labels{display:flex;gap:8px;margin-bottom:24px}
.chart-labels span{flex:1;text-align:center;font-size:10px;color:#666}
.refresh{display:inline-block;margin-top:8px;color:#c8a44e;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase}
</style></head><body>
<h1>Carrington Brown — Analytics</h1>
<p class="subtitle">Real-time website performance &bull; ${today}</p>
<a href="/dashboard?key=${DASHBOARD_KEY}" class="refresh">Refresh Data</a>

<div class="section-title">Overview</div>
<div class="grid">
<div class="card"><div class="card-number">${viewsToday}</div><div class="card-label">Views Today</div></div>
<div class="card"><div class="card-number">${viewsYesterday}</div><div class="card-label">Yesterday</div></div>
<div class="card"><div class="card-number">${views7d}</div><div class="card-label">Last 7 Days</div></div>
<div class="card"><div class="card-number">${views30d}</div><div class="card-label">Last 30 Days</div></div>
<div class="card"><div class="card-number">${analytics.totalPageViews}</div><div class="card-label">All-Time Views</div></div>
<div class="card"><div class="card-number">${analytics.uniqueVisitors.size}</div><div class="card-label">Unique Visitors</div></div>
</div>

<div class="section-title">Daily Views (Last 14 Days)</div>
<div class="chart">${chartValues.map((v, i) => `<div class="chart-bar" style="height:${Math.max(4, (v / (Math.max(...chartValues) || 1)) * 160)}px"><span>${v}</span></div>`).join('')}</div>
<div class="chart-labels">${chartDays.map(d => `<span>${d}</span>`).join('')}</div>

<div class="section-title">Device Breakdown</div>
<div class="grid">
<div class="card"><div class="card-number">${analytics.devices.mobile || 0}</div><div class="card-label">Mobile</div></div>
<div class="card"><div class="card-number">${analytics.devices.desktop || 0}</div><div class="card-label">Desktop</div></div>
<div class="card"><div class="card-number">${analytics.devices.tablet || 0}</div><div class="card-label">Tablet</div></div>
</div>

<div class="section-title">Form Submissions</div>
<div class="grid">
<div class="card"><div class="card-number">${analytics.formSubmissions.contact}</div><div class="card-label">Booking Inquiries</div></div>
<div class="card"><div class="card-number">${analytics.formSubmissions.beatSubmission}</div><div class="card-label">Beat Submissions</div></div>
</div>

<div class="section-title">Section Engagement</div>
<table><tr><th>Section</th><th>Views</th><th>Activity</th></tr>
${sortedSections.map(([s, v]) => `<tr><td>${s}</td><td>${v}</td><td><div class="bar" style="width:${Math.max(4, (v / (sortedSections[0]?.[1] || 1)) * 200)}px"></div></td></tr>`).join('')}
${sortedSections.length === 0 ? '<tr><td colspan="3" style="color:#666">Tracking will populate as visitors scroll through sections</td></tr>' : ''}
</table>

<div class="section-title">Button / Link Clicks</div>
<table><tr><th>Element</th><th>Clicks</th><th>Activity</th></tr>
${sortedClicks.map(([b, v]) => `<tr><td>${b}</td><td>${v}</td><td><div class="bar" style="width:${Math.max(4, (v / (sortedClicks[0]?.[1] || 1)) * 200)}px"></div></td></tr>`).join('')}
${sortedClicks.length === 0 ? '<tr><td colspan="3" style="color:#666">Tracking will populate as visitors click buttons and links</td></tr>' : ''}
</table>

<div class="section-title">Top Referrers</div>
<table><tr><th>Source</th><th>Visits</th></tr>
${sortedReferrers.map(([r, v]) => `<tr><td>${r}</td><td>${v}</td></tr>`).join('')}
${sortedReferrers.length === 0 ? '<tr><td colspan="2" style="color:#666">Referrer data will populate with traffic</td></tr>' : ''}
</table>

<div class="section-title" style="margin-top:48px;color:#666">Hourly Traffic Distribution</div>
<table><tr><th>Hour</th><th>Views</th></tr>
${Object.entries(analytics.hourlyTraffic || {}).sort((a,b) => b[1]-a[1]).slice(0,12).map(([h,v]) => `<tr><td>${h}:00</td><td>${v}</td></tr>`).join('')}
</table>

<p style="margin-top:48px;color:#444;font-size:12px">&copy; 2026 Carrington Brown Analytics &bull; Data resets on server restart unless persisted</p>
</body></html>`);
});

// ── Serve static files ──
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '7d'
}));

// ── Serve index.html for all other routes ──
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Save on exit ──
process.on('SIGINT', () => { saveAnalytics(analytics); process.exit(); });
process.on('SIGTERM', () => { saveAnalytics(analytics); process.exit(); });

app.listen(PORT, () => {
    console.log(`♠ Carrington Brown site live on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard?key=${DASHBOARD_KEY}`);
});
