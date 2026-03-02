import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    // Check if requesting all events (for admin)
    const url = new URL(req.url);
    const showAll = url.searchParams.get('all') === 'true';
    
    const today = new Date();
    // Show from start of current month so past dates this month remain visible
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    let query = supabase.from('events').select('*');
    
    // For public feed, return all events so navigation to any month works.
    // Admin (?all=true) is kept for consistency but has no additional effect now.
    const { data, error } = await query
      .order('date', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;

    // Deduplicate events by id and by title+date+time combination
    const seen = new Set();
    const uniqueEvents = (data || []).filter(event => {
      const idKey = event.id;
      const contentKey = `${event.title}|${event.date}|${event.time}`;
      
      if (seen.has(idKey) || seen.has(contentKey)) {
        return false;
      }
      
      seen.add(idKey);
      seen.add(contentKey);
      return true;
    });

    return new Response(JSON.stringify({ events: uniqueEvents }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('get-events error:', err);
    return new Response(JSON.stringify({ events: [], error: err.message }), {
      status: 500,
      headers,
    });
  }
}
