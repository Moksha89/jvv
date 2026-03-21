# Testing newsreporter.live Admin Panel & AI Generation

## Overview
The newsreporter.live site has a news frontend, admin panel (CMS), and a hidden remote access portal. The admin panel is accessed via a hidden "reportersays" link in the sidebar.

## Devin Secrets Needed
- `VPS_SSH_PASSWORD` - SSH password for VPS at 93.127.138.82 (user: administrator)
- `ADMIN_PANEL_PASSWORD` - Password for the admin panel login
- `OPENROUTER_API_KEY` - API key for AI article generation via OpenRouter

## Key URLs
- **News Site:** https://newsreporter.live
- **Admin Panel:** https://newsreporter.live/sarkar (click "reportersays" in Quick Links sidebar, then enter admin password)
- **Remote Portal:** Hidden behind /sarkar, requires separate portal password
- **VPS:** 93.127.138.82 (SSH as administrator)

## Admin Panel Login Flow
1. Navigate to https://newsreporter.live/sarkar
2. The page shows the public news site with a sidebar containing "Quick Links"
3. Click "reportersays" link in the Quick Links section
4. A password popup appears - enter the admin password
5. This calls `/api/admin/login` which returns a JWT token stored in sessionStorage
6. The admin panel sidebar and content area appear

## Known Issues
- **Articles page shows empty after fresh login:** The `loadArticles()` function uses plain `fetch()` instead of `authFetch()`, so it doesn't send the JWT Bearer token. The Dashboard and AI Auto-Publish pages work correctly because they use `authFetch()`. Workaround: use Dashboard to verify article counts, or use the browser console to manually call the API with the token.
- **JWT invalidation on server restart:** When the relay-api service is restarted on VPS, existing JWT tokens may be invalidated if the JWT secret is regenerated. Users need to re-login after a server restart.
- **Session race condition:** If you navigate to Articles before the login API response completes, the page loads without auth. Navigate away and back to fix.

## AI Article Generation Testing
1. Go to AI Auto-Publish in the admin sidebar
2. Set Generation Mode to "Single Category" for quick tests
3. Select a category and set articles to 1
4. Click "Generate Articles" - takes ~20-30 seconds
5. Verify the generated article title is a real headline (not prompt text like "Write an original...")
6. Check the article on the frontend by navigating to https://newsreporter.live
7. Click the article to verify content is clean HTML (no raw JSON, no `\n\n`, no `\"`)

## Deployment to VPS
```bash
# Copy server.js to VPS
scp /path/to/server.js administrator@93.127.138.82:/opt/remote-relay/api/server.js

# Restart the service
ssh administrator@93.127.138.82 "echo 'PASSWORD' | sudo -S systemctl restart relay-api"

# Check logs
ssh administrator@93.127.138.82 "echo 'PASSWORD' | sudo -S journalctl -u relay-api --no-pager -n 30"
```

## Database Access
- SQLite database at `/opt/remote-relay/api/data/relay.db` on VPS
- Query articles: `sqlite3 /opt/remote-relay/api/data/relay.db "SELECT id, title FROM articles ORDER BY id DESC LIMIT 10;"`
- Find broken articles: `sqlite3 /opt/remote-relay/api/data/relay.db "SELECT id, title FROM articles WHERE title LIKE 'Write an original%';"`

## Common AI Generation Issues
- **Prompt text as title:** The AI response JSON parsing failed and the fallback used the prompt as the title. Fixed by extracting fallback title from content instead.
- **Raw JSON in content:** AI returned JSON wrapped in markdown code blocks (` ```json ... ``` `). Fixed with better regex stripping.
- **Escaped characters:** Content had literal `\n\n` and `\"` instead of proper formatting. Fixed with cleanup regex.
