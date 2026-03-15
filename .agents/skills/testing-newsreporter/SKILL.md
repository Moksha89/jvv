# Testing newsreporter.live

## Overview
The newsreporter.live site is a news website with an AI article generator and a hidden remote access portal accessible via the "reportersays" trigger word.

## Devin Secrets Needed
- `VPS_PASSWORD` — SSH/admin password for VPS at 93.127.138.82
- `OPENROUTER_API_KEY` — OpenRouter API key for AI article generation

## Key URLs
- **News Site**: https://newsreporter.live
- **Admin Panel**: https://newsreporter.live/sarkar (password: stored in VPS_PASSWORD secret)
- **Portal**: https://newsreporter.live/portal (only accessible via reportersays trigger + cookie)
- **API**: https://newsreporter.live/api/cms/articles

## VPS Deployment
- Server IP: 93.127.138.82
- Web files: `/opt/remote-relay/newssite/` (index.html, admin.html)
- API server: `/opt/remote-relay/api/server.js`
- Database: `/opt/remote-relay/api/data/relay.db`
- Service: `relay-api` (restart with `systemctl restart relay-api`)
- After editing files in the repo, deploy to VPS with `scp` then restart the service
- If admin.html appears blank/broken, check file size — it may have been corrupted (0 bytes) during a bad deploy

## Testing AI Article Generation
1. Navigate to https://newsreporter.live/sarkar
2. Enter admin password in login overlay
3. Click "AI Auto-Publish" in sidebar
4. The AI Article Generator card has three modes:
   - **Bulk - All Categories**: Generates articles across all 15 categories
   - **Single Category**: Shows category dropdown (15 categories including Cricket, IPL, Gadget Reviews, etc.)
   - **Single Topic (Custom)**: Shows free-text topic input + category selector
5. Select mode, configure options, click "Generate Articles"
6. Generation takes 15-30 seconds per article via OpenRouter API
7. Verify in AI Activity Log that new article appears
8. Check the news homepage to see the article in Latest News / Trending

### Common Issues
- If generation fails, check the OpenRouter API key is configured (visible in AI Configuration section, stored in DB `settings` table)
- The success message may show incorrect category count (e.g., "15 category/categories" even for single category) — this is a minor UI text issue, the actual generation is correct
- If the articles API returns errors like "Too many parameter values", check `server.js` GET `/api/cms/articles` endpoint — better-sqlite3 is strict about parameter count matching placeholders

## Testing Reportersays Portal Redirect
1. Navigate to https://newsreporter.live
2. Click any article card to open the article detail modal
3. The word "reportersays" in article content is automatically wrapped in a `<span class="rs-trigger">` by JavaScript
4. Click the "reportersays" text — a password gate modal ("Access Restricted") appears
5. Enter the admin password and click "Enter"
6. Browser should redirect to https://newsreporter.live/portal
7. The portal sets a cookie `portal_auth=granted` with `SameSite=Lax; Secure` flags

### Common Issues
- The `.rs-trigger` span may not have a `devinid` attribute — use JavaScript console to find and click it: `document.querySelector('.rs-trigger').click()`
- If portal redirect goes to the news homepage instead of /portal, check:
  - Cookie flags in index.html (needs `SameSite=Lax; Secure` for HTTPS)
  - Nginx config at `/etc/nginx/sites-available/newsreporter` — the `/portal` location block must check the `portal_auth` cookie
- Direct navigation to /portal without the cookie should redirect to homepage
- Direct IP access (http://93.127.138.82/portal) should not show the portal

## Nginx Configuration
- Config file: `/etc/nginx/sites-available/newsreporter`
- After changes: `nginx -t && systemctl reload nginx`
- The `/portal` location checks for `portal_auth=granted` cookie before serving content
