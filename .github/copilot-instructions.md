# Calendar View — Copilot Instructions

## Project Overview
Embeddable organization calendar with auto-sync from Instagram — React frontend, Netlify Functions backend, OpenAI GPT-4o event extraction.

## Completed Steps
- [x] copilot-instructions.md created in .github
- [x] Project requirements clarified
- [x] Project scaffolded: client/ (React) and Netlify Functions
- [x] README.md and .gitignore added
- [x] MAS Queens-style CalendarView built (month grid, event modal, embed code, dark mode)
- [x] Migrated from Express to Netlify Functions + Supabase
- [x] OpenAI GPT-4o integration for event extraction
- [x] Instagram scraping with multi-endpoint fallback
- [x] Embed mode with theme parameter support
- [x] Password-protected admin interface
- [x] Documentation finalized

## Key Files
- `client/src/CalendarView.js` — main calendar component
- `client/src/CalendarView.css` — calendar styles
- `client/src/App.js` — app shell with routing and embed detection
- `client/src/App.css` — global layout styles
- `client/src/Admin.js` — admin interface component
- `client/src/Admin.css` — admin dark theme styles
- `client/src/EmbedCode.js` — embed code generator with copy button
- `netlify/functions/get-events.mjs` — fetch events from Supabase
- `netlify/functions/cron-poller.mjs` — hourly Instagram polling
- `netlify/functions/extract-event.mjs` — OpenAI event extraction
- `netlify/functions/delete-event.mjs` — admin event deletion
- `supabase/schema.sql` — database schema

## How to Run
```bash
npm run install:all   # install all dependencies once
netlify dev           # start development server (localhost:8888)
```

Access admin interface at: `http://localhost:8888/admin`

## Development Guidelines
- Keep communication concise and focused.
- Follow development best practices.
- Dark theme uses MAS Queens colors (#1a1a18, #c9a96e)
- All sensitive data in .env (gitignored)
- Admin password required for both backend (ADMIN_PASSWORD) and frontend (REACT_APP_ADMIN_PASSWORD)

