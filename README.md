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
ADMIN_SESSION_SECRET=optional-extra-session-signing-secret

# WhatsApp Webhook (official Business Platform intake)
WHATSAPP_VERIFY_TOKEN=your-verify-token
WHATSAPP_APP_SECRET=your-app-secret
WHATSAPP_ACCESS_TOKEN=your-system-user-or-cloud-api-token
WHATSAPP_SEND_CONFIRMATIONS=false
WHATSAPP_ALLOWED_SENDERS=17185551234,13475551234
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
- **`admin-auth`** — validates admin login server-side and returns a short-lived admin session token
- **`whatsapp-webhook`** — receives direct WhatsApp Business Platform messages, downloads forwarded flyer images, extracts event details, uploads the flyer to Supabase Storage, and inserts the event
- **`trusted-senders`** — admin-only endpoint for adding/removing WhatsApp numbers allowed to submit events

## WhatsApp Business Platform Intake

Configure the Meta webhook callback URL to:

```text
https://your-netlify-site.netlify.app/.netlify/functions/whatsapp-webhook
```

Subscribe the app to WhatsApp `messages` webhooks. When an approved sender forwards an event flyer or sends event details directly to the MAS Queens WhatsApp Business number, the webhook:

1. Verifies the Meta webhook token/signature.
2. Checks the sender against `WHATSAPP_ALLOWED_SENDERS`.
3. Downloads image media from the WhatsApp Cloud API.
4. Sends the flyer and caption/text to OpenAI for event extraction.
5. Uploads the flyer image to the `event-images` Supabase Storage bucket.
6. Inserts the event into the `events` table.
7. Stores the WhatsApp message ID in `processing_state` to avoid duplicate inserts on Meta retries.

Set `WHATSAPP_SEND_CONFIRMATIONS=true` if the webhook should send a short WhatsApp confirmation back to the sender after an event is added or ignored.

`WHATSAPP_ALLOWED_SENDERS` is an optional bootstrap allowlist. Use comma-separated phone numbers in international format without `+`, for example `17185551234,13475551234`.

The preferred day-to-day flow is to open `/admin`, log in, and use **WhatsApp Trusted Senders** to add the first trusted number and manage the list without code or redeploys. Dashboard-managed numbers are stored in Supabase `processing_state` under `whatsapp_trusted_senders`.

Trusted senders can add another trusted sender by sending a direct WhatsApp message to the business number:

```text
trust +17185551234
```

Numbers in `WHATSAPP_ALLOWED_SENDERS` remain locked bootstrap senders and cannot be removed through the dashboard or WhatsApp commands.

## Admin Interface

Access the admin page at `/admin` and log in with your configured password.

**Features:**
- **Manual event submission** — submit Instagram posts manually for immediate processing
- **Event management** — view all events (including past ones) with thumbnails
- **Delete events** — remove incorrect or duplicate events
- **Dark theme** — matches MAS Queens editorial design

To set up the admin page, configure `ADMIN_PASSWORD`. Optionally set `ADMIN_SESSION_SECRET` to a separate random value for signing short-lived admin session tokens.

## Roadmap
- [ ] Multi-organization support
- [x] Manual event creation UI (via admin interface)
- [ ] Calendar theme switcher
- [ ] iCal / Google Calendar export


# calendar-view
