-- ─────────────────────────────────────────────────────────────
-- Events table
-- ─────────────────────────────────────────────────────────────
create table if not exists events (
  id                   bigserial primary key,
  instagram_post_id    text unique,
  instagram_shortcode  text,
  instagram_post_url   text,
  title                text,
  date                 date,
  time                 text,
  end_time             text,
  description          text,
  location             text,
  image_url            text,
  registration_link    text,
  tags                 text[],
  is_featured          boolean default false,
  created_at           timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Processing state table (cron watermarks, etc.)
-- ─────────────────────────────────────────────────────────────
create table if not exists processing_state (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table events           enable row level security;
alter table processing_state enable row level security;

-- Public can read events
create policy "Public read events"
  on events for select
  using (true);

-- Only service role can insert / update events
create policy "Service role insert events"
  on events for insert
  with check (auth.role() = 'service_role');

create policy "Service role update events"
  on events for update
  using (auth.role() = 'service_role');

-- Only service role can read / write processing_state
create policy "Service role all on processing_state"
  on processing_state for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
