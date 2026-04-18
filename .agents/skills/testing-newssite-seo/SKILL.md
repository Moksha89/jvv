# Testing News Site SEO Features

## Overview
The news site at https://newsreporter.live has SEO features including favicon, sitemap.xml, robots.txt, RSS feed, JSON-LD structured data, author profiles, and Google Search Console verification.

## Devin Secrets Needed
- VPS SSH credentials (administrator account) for server access at 93.127.138.82
- Admin panel password for https://newsreporter.live/admin

## Key Endpoints to Verify
- `https://newsreporter.live/` - Main news site with favicon in browser tab
- `https://newsreporter.live/favicon.svg` - SVG favicon (NR LIVE logo)
- `https://newsreporter.live/sitemap.xml` - Dynamic XML sitemap with article URLs
- `https://newsreporter.live/robots.txt` - Crawler directives with sitemap URL
- `https://newsreporter.live/rss` - RSS 2.0 feed with media:content
- `https://newsreporter.live/team` - Author profiles page
- `https://newsreporter.live/about`, `/privacy`, `/terms`, `/contact` - Static SEO pages

## Testing JSON-LD Structured Data
1. Navigate to the news site homepage
2. Click any article card to open the detail modal
3. Wait for the modal to load (it fetches `/api/news/:slug/structured-data`)
4. In browser console, run:
   ```js
   console.log('ARTICLE_LD:', JSON.stringify(JSON.parse(document.querySelector('script[data-article-ld]').textContent)))
   ```
5. Verify the JSON-LD contains: `@type: NewsArticle`, `author.name`, `author.jobTitle`, `publisher.name`, `articleSection`, `wordCount`
6. Check for BreadcrumbList schema (second `data-article-ld` script tag)

## Verifying Google Search Console Tag
In browser console on the homepage:
```js
console.log('VERIFICATION:', document.querySelector('meta[name="google-site-verification"]').getAttribute('content'))
```

## Verifying Author Profiles
- Each category has a specific author (e.g., Politics → Rajesh Kumar Sharma, Technology → Ananya Desai)
- Article cards on homepage show the category-specific author name
- Article detail modal shows author avatar (initials), name, and title
- The /team page lists all 13 unique authors with their categories

## Architecture Notes
- Backend: Node.js Express server at `/opt/remote-relay/api/server.js` on VPS
- Frontend: Single-page app at `/opt/remote-relay/newssite/index.html`
- Database: SQLite at `/opt/remote-relay/api/data/relay.db`
- Nginx reverse proxy handles routing SEO endpoints to the Node.js API
- Category authors are defined in both `CATEGORY_AUTHORS` (server.js) and `categoryAuthors` (index.html)

## Common Issues
- If endpoints return 502, the relay-api service may need restarting: `ssh administrator@93.127.138.82 'systemctl restart relay-api'`
- If sitemap shows no articles, check that articles have `status = 'published'` in the database
- The browser console approach for checking meta tags requires using `console.log()` since direct return values may show as `None` in the testing tool
