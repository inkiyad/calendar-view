import crypto from 'crypto';

const SESSION_TTL_SECONDS = 12 * 60 * 60;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function createToken() {
  const payload = base64Url(JSON.stringify({
    scope: 'calendar-admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }));
  return `${payload}.${sign(payload)}`;
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

  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || body.password !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return jsonResponse({ token: createToken() });
}
