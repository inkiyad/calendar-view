import { createClient } from '@supabase/supabase-js';

const TRUSTED_SENDERS_KEY = 'whatsapp_trusted_senders';
const BOOTSTRAP_ALLOWED_SENDERS = (process.env.WHATSAPP_ALLOWED_SENDERS || '')
  .split(',')
  .map(normalizePhone)
  .filter(Boolean);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function assertAdmin(password) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || password !== expected) {
    return false;
  }
  return true;
}

async function getStoredSenders() {
  const { data, error } = await supabase
    .from('processing_state')
    .select('value')
    .eq('key', TRUSTED_SENDERS_KEY)
    .maybeSingle();

  if (error) throw error;

  return (data?.value || '')
    .split(',')
    .map(normalizePhone)
    .filter(Boolean);
}

async function saveStoredSenders(senders) {
  const normalized = [...new Set(senders.map(normalizePhone).filter(Boolean))].sort();
  const { error } = await supabase
    .from('processing_state')
    .upsert({
      key: TRUSTED_SENDERS_KEY,
      value: normalized.join(','),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
  return normalized;
}

function serializeSenders(storedSenders) {
  const bootstrap = BOOTSTRAP_ALLOWED_SENDERS.map((number) => ({
    number,
    source: 'bootstrap',
    removable: false,
  }));

  const managed = storedSenders
    .filter((number) => !BOOTSTRAP_ALLOWED_SENDERS.includes(number))
    .map((number) => ({
      number,
      source: 'dashboard',
      removable: true,
    }));

  return [...bootstrap, ...managed].sort((a, b) => a.number.localeCompare(b.number));
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!assertAdmin(body.adminPassword)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const action = body.action || 'list';
    const storedSenders = await getStoredSenders();

    if (action === 'list') {
      return jsonResponse({ senders: serializeSenders(storedSenders) });
    }

    if (action === 'add') {
      const number = normalizePhone(body.number);
      if (!number) return jsonResponse({ error: 'Valid phone number is required' }, 400);

      const nextStored = await saveStoredSenders([...storedSenders, number]);
      return jsonResponse({ senders: serializeSenders(nextStored), added: number });
    }

    if (action === 'remove') {
      const number = normalizePhone(body.number);
      if (!number) return jsonResponse({ error: 'Valid phone number is required' }, 400);
      if (BOOTSTRAP_ALLOWED_SENDERS.includes(number)) {
        return jsonResponse({ error: 'Bootstrap senders must be removed from Netlify env vars' }, 400);
      }

      const nextStored = await saveStoredSenders(storedSenders.filter((sender) => sender !== number));
      return jsonResponse({ senders: serializeSenders(nextStored), removed: number });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('[trusted-senders] Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
}
