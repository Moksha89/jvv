# Testing Remote Access Portal

## Overview
The remote access portal is a web-based interface at `https://newsreporter.live/portal` that allows users to connect to remote Windows PCs via RDP/VNC through Guacamole. The admin panel at `https://newsreporter.live/sarkar` manages users and device assignments.

## Architecture
- **API Server**: Node.js + Express + SQLite at port 3000 on VPS (93.127.138.82)
- **Service name**: `relay-api` (managed via systemctl)
- **Database**: SQLite at `/opt/remote-relay/api/data/relay.db`
- **Portal HTML**: `/opt/remote-relay/portal.html`
- **Admin HTML**: `/opt/remote-relay/newssite/admin.html`
- **Server JS**: `/opt/remote-relay/api/server.js`

## Devin Secrets Needed
- VPS SSH credentials (username: administrator, stored as environment secrets)
- Admin panel password (for the `/sarkar` admin panel)
- Portal gate password (for the reportersays trigger flow)

## Accessing the Portal for Testing
The portal at `/portal` requires a `portal_auth=granted` cookie set via the "reportersays" trigger word flow on the news site. The cookie is **one-time use** (deleted on page load).

**Shortcut for testing**: Set the cookie via browser console before navigating:
```javascript
document.cookie = 'portal_auth=granted; path=/; SameSite=Lax; Secure';
window.location.href = '/portal';
```
This must be done from the `newsreporter.live` domain (not the raw IP).

## Accessing the Admin Panel
Navigate directly to `https://newsreporter.live/sarkar`. No additional auth is currently required beyond knowing the URL.

## Deploying Changes to VPS
1. SCP files to `/tmp/` on VPS: `sshpass -p '<password>' scp -o StrictHostKeyChecking=no <file> administrator@93.127.138.82:/tmp/<file>`
2. Move files with sudo: `sshpass -p '<password>' ssh -o StrictHostKeyChecking=no administrator@93.127.138.82 "echo '<password>' | sudo -S cp /tmp/<file> /opt/remote-relay/<dest>"`
3. Restart service: `echo '<password>' | sudo -S systemctl restart relay-api`

## Testing Portal Users Module
1. Go to admin panel → Portal Users section
2. Click "+ New User" to create users with device assignments
3. Device checkboxes are populated from both API devices and FRP proxies
4. After creating a user, access the portal (via cookie shortcut above)
5. Login with user credentials
6. Verify only assigned devices appear for non-admin users
7. Admin-role users see all devices with "(admin - all)" in device count

## Portal Login Form Notes
- The login form inputs may not respond well to Playwright's click+type. Use JavaScript console to fill and submit:
```javascript
document.getElementById('loginUser').value = 'username';
document.getElementById('loginPass').value = 'password';
handleLogin(new Event('submit'));
```
- Logout can be triggered via: `portalLogout();`

## Common Issues
- **Portal redirects to homepage**: The `portal_auth` cookie was consumed. Re-set it before navigating.
- **Service won't restart**: Check service name is `relay-api` (not `remote-relay`)
- **Permission denied on SCP**: Copy to `/tmp/` first, then use `sudo -S cp` to move files
- **Device IDs in assignments**: Device IDs come from FRP proxy names (e.g., `ANDHRAWALA-`, `VARMA678`). The matching uses substring contains, so be aware that partial matches might occur.
