# Pro Helper — public website

The marketing site: plain HTML, CSS and vanilla JS. No build step, no
dependencies, no framework.

```
public/site/
├── index.html    every section, in one page
├── styles.css    design tokens + layout
├── script.js     nav, scroll-spy, service switcher, FAQ accordion
└── assets/       logo + web-sized photography
```

## How it is served

It lives in Next's `public/` folder and is mapped to the site root by a
`beforeFiles` rewrite in `web/next.config.ts`:

```
/  →  /site/index.html
```

So one deployment serves both areas:

| Path | What |
|---|---|
| `/` | This marketing site |
| `/admin` | Redirects to the dashboard or sign-in |
| `/admin/login` | Admin sign-in |
| `/admin/dashboard`, `/admin/helpers`, `/admin/bookings`, `/admin/customers`, `/admin/services`, `/admin/settings` | Admin dashboard |

Serving it as a static asset rather than porting it to JSX is deliberate: its
stylesheet never enters the Next document, so it cannot leak into the admin
pages. The two areas share a domain, not a design system.

**Asset paths must stay absolute** (`/site/styles.css`, `/site/assets/...`).
Relative paths break, because at `/` the browser resolves them against the root.

## Running it

```bash
cd web && npm run dev     # → http://localhost:3000
```

## Sections

Home · About · Services · How It Works · For Customers · For Helpers · FAQ ·
Get the App · Contact.

**Every call to action — "Get Started", "Become a Helper", "Book Now" — scrolls
to `#get-app`**, the section carrying the App Store and Google Play links.

## Before it goes live

1. **Store links.** The two badges in `#get-app` point at `href="#"`. Swap in the
   real listings once the apps are published.
2. **Contact details.** `support@prohelper.in` and `1800 000 000` are placeholders.
3. **Legal pages.** "Privacy Policy" and "Terms of Service" are not yet links.
4. **Photography.** Reused from the mobile app. Anything showing a person should
   be cleared for marketing use, or replaced with licensed shots.
