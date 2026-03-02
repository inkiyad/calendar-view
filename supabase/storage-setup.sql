-- Run this in your Supabase SQL editor to create the event-images storage bucket.

-- 1. Create the public bucket
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- 2. Allow service role to upload
create policy "service_role can upload event images"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'event-images');

-- 3. Allow public to view images
create policy "public can view event images"
  on storage.objects for select
  to public
  using (bucket_id = 'event-images');
