import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
};

const ALLOWED_EVENT_FIELDS = new Set([
  'title', 'date', 'time', 'end_time', 'description',
  'location', 'image_url', 'registration_link', 'tags',
  'instagram_post_id', 'instagram_shortcode', 'instagram_post_url',
  'is_featured',
]);

function sanitizeEventFields(body) {
  const clean = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_EVENT_FIELDS.has(key)) clean[key] = body[key];
  }
  return clean;
}

function unauthorized(req) {
  console.warn('[admin-events] Unauthorized access attempt from', req.headers.get('x-forwarded-for') || 'unknown');
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function checkAuth(req) {
  if (!ADMIN_PASSWORD) {
    console.warn('[admin-events] ADMIN_PASSWORD env var is not configured — all requests will be rejected');
    return false;
  }
  const pw = req.headers.get('x-admin-password');
  return pw === ADMIN_PASSWORD;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!checkAuth(req)) return unauthorized(req);

  const headers = { 'Content-Type': 'application/json', ...corsHeaders };

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ events: data || [] }), { status: 200, headers });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const payload = sanitizeEventFields(body);
      const { data, error } = await supabase
        .from('events')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ event: data }), { status: 201, headers });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { id, ...rest } = body;
      if (!id) throw new Error('Event id is required for updates');
      const fields = sanitizeEventFields(rest);
      const { data, error } = await supabase
        .from('events')
        .update(fields)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error('Event not found');
      return new Response(JSON.stringify({ event: data }), { status: 200, headers });
    }

    if (req.method === 'DELETE') {
      const body = await req.json();
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', body.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
