# Calendar View

An embeddable, auto-updating calendar for organizations. Features Instagram-powered event extraction via Claude AI, dark mode, featured images, and responsive design.

## Features
- **Auto-sync from Instagram** — hourly cron job extracts events from Instagram posts using Claude AI
- **Month grid view** — always 7-column grid with featured images, works on all screen sizes
- **Dark mode toggle** — persisted preference
- **Event detail modal** — click any tile to see all events for that day
- **Responsive** — desktop, tablet, and mobile optimized
- **Embeddable** — one-click copy iframe code

## Tech Stack
- **Frontend:** React (create-react-app)
- **Backend:** Netlify Functions + Supabase
- **AI:** Claude Sonnet 4 for event extraction
- **Data:** Supabase (PostgreSQL + RLS)

## Setup

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Configure environment variables
Create a `.env` file in the project root with the following:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Anthropic AI Configuration
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Instagram Configuration
INSTAGRAM_HANDLE=masqueenscenter

# Organization Details (for event extraction prompt)
ORG_NAME=MAS Queens Center
ORG_DESCRIPTION=a Muslim community center
ORG_ADDRESS=46-01 20th Ave, Astoria, NY 11105
EVENT_TAGS=lecture,youth,sisters,brothers,fundraiser,interfaith,quran,community,free,ticketed
```

**Note:** The `.env` file is gitignored and will not be committed to your repository.

### 3. Set up Supabase database
Run the SQL in `supabase/schema.sql` in your Supabase SQL editor to create:
- `events` table (with RLS policies)
- `processing_state` table (for cron watermarks)

### 4. Run locally
```bash
netlify dev
```
Opens at `http://localhost:8888`

## Deployment

Push to your Git repo connected to Netlify. Add all environment variables in **Netlify Dashboard → Site Settings → Environment Variables**.

Netlify will:
- Build the React app from `client/`
- Deploy serverless functions from `netlify/functions/`
- Run `cron-poller` every hour to fetch new Instagram posts

## Functions

- **`get-events`** — returns upcoming events from Supabase
- **`cron-poller`** — runs every hour, fetches Instagram posts, calls extract-event
- **`extract-event`** — sends post to Claude, parses JSON, upserts to Supabase

## Roadmap
- [ ] Multi-organization support
- [ ] Manual event creation UI
- [ ] Calendar theme switcher
- [ ] iCal / Google Calendar export


# calendar-view
