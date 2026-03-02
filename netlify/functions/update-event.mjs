import { createClient } from '@supabase/supabase-js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }

  const { id, eventData } = body;
  if (!id || !eventData) {
    return new Response(JSON.stringify({ error: 'Missing id or eventData' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error } = await supabase
    .from('events')
    .update({
      title:             eventData.title             ?? null,
      date:              eventData.date              ?? null,
      time:              eventData.time              ?? null,
      end_time:          eventData.end_time          ?? null,
      location:          eventData.location          ?? null,
      description:       eventData.description       ?? null,
      registration_link: eventData.registration_link ?? null,
      tags:              eventData.tags              ?? null,
    })
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
