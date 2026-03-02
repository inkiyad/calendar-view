# Calendar View

An embeddable, auto-updating calendar for organizations. Features Instagram-powered event extraction via GPT-4o, dark mode, featured images, and responsive design.

## Features
- **Auto-sync from Instagram** — hourly cron job extracts events from Instagram posts using GPT-4o
- **Admin interface** — password-protected page for manual event submission and deletion
- **Month grid view** — always 7-column grid with featured images, works on all screen sizes
- **Dark mode toggle** — persisted preference
- **Event detail modal** — click any tile to see all events for that day
- **Responsive** — desktop, tablet, and mobile optimized
- **Embeddable** — one-click copy iframe code

## Tech Stack
- **Frontend:** React (create-react-app)
- **Backend:** Netlify Functions + Supabase
- **AI:** OpenAI GPT-4o for event extraction
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

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Instagram Configuration
INSTAGRAM_HANDLE=masqueenscenter

# Organization Details (for event extraction prompt)
ORG_NAME=MAS Queens Center
ORG_DESCRIPTION=a Muslim community center
ORG_ADDRESS=46-01 20th Ave, Astoria, NY 11105
EVENT_TAGS=lecture,youth,sisters,brothers,fundraiser,interfaith,quran,community,free,ticketed

# Admin Configuration
ADMIN_PASSWORD=your-secure-password-here
REACT_APP_ADMIN_PASSWORD=your-secure-password-here
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

- **`get-events`** — returns upcoming events from Supabase (supports `?all=true` for admin)
- **`cron-poller`** — runs every hour, fetches Instagram posts, calls extract-event
- **`extract-event`** — sends post to GPT-4o, parses JSON, upserts to Supabase
- **`delete-event`** — password-protected endpoint for deleting events

## Admin Interface

Access the admin page at `/admin` and log in with your configured password.

**Features:**
- **Manual event submission** — submit Instagram posts manually for immediate processing
- **Event management** — view all events (including past ones) with thumbnails
- **Delete events** — remove incorrect or duplicate events
- **Dark theme** — matches MAS Queens editorial design

To set up the admin page, ensure both `ADMIN_PASSWORD` and `REACT_APP_ADMIN_PASSWORD` are configured in your `.env` file.

## Roadmap
- [ ] Multi-organization support
- [x] Manual event creation UI (via admin interface)
- [ ] Calendar theme switcher
- [ ] iCal / Google Calendar export


# calendar-view
