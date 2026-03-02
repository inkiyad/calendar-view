import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────
const ORG_NAME        = process.env.ORG_NAME        || 'your organization';
const ORG_DESCRIPTION = process.env.ORG_DESCRIPTION || 'a community center';
const ORG_ADDRESS     = process.env.ORG_ADDRESS     || '';
const EVENT_TAGS      = process.env.EVENT_TAGS      || 'lecture,youth,sisters,brothers,fundraiser,interfaith,community,free,ticketed';

const SYSTEM_PROMPT = `You are an event data extractor for ${ORG_NAME}, ${ORG_DESCRIPTION}${ORG_ADDRESS ? ' at ' + ORG_ADDRESS : ''}.

You will receive a screenshot of an Instagram post which may be from a phone or desktop. Read both the flyer image AND any caption text visible.

Return ONLY valid JSON with this exact schema:
{
  "is_event": bool,
  "title": string,
  "date": "YYYY-MM-DD",
  "time": "H:MM AM/PM",
  "end_time": "H:MM AM/PM or null",
  "description": "string (1-3 sentences)",
  "location": string,
  "image_url": "string (use empty string)",
  "registration_link": "string or null",
  "tags": ["array from [${EVENT_TAGS}]"],
  "crop": {
    "x": 0,
    "y": 0,
    "width": 100,
    "height": 65
  }
}

crop.height is the percentage from top where the flyer ends before caption text begins. Typically 65-80% for phone screenshots, 45-60% for desktop. Default 65 if unsure.
Only extract events with a specific date.
Set is_event: false for weather advisories, general announcements, or prayer schedules.`;

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Shared OpenAI call ───────────────────────────────────────────────────────
async function callOpenAI(imageDataUrl, captionText) {
  const content = [
    { type: 'image_url', image_url: { url: imageDataUrl } },
    { type: 'text', text: captionText || 'Extract event details from this Instagram post screenshot.' },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() ?? '{}';
  console.log('[extract-event] OpenAI raw response:', raw);

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
}

// ─── Fetch image from URL (used by cron-poller) ───────────────────────────────
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return { base64, contentType };
  } catch (error) {
    console.error('[fetchImageAsBase64] Error fetching image:', error.message);
    throw new Error(`Unable to fetch image from ${url}: ${error.message}`);
  }
}



// ─── Used by cron-poller: fetches image from URL, saves to Supabase ───────────
export async function extractEventFromPost(post) {
  const { instagramPostId, instagramShortcode, instagramPostUrl, imageUrl, caption } = post;

  const captionText = `Instagram caption:\n\n${caption}\n\nPost URL: ${instagramPostUrl}`;

  let extracted;
  if (imageUrl) {
    try {
      const { base64, contentType } = await fetchImageAsBase64(imageUrl);
      extracted = await callOpenAI(`data:${contentType};base64,${base64}`, captionText);
    } catch (err) {
      console.warn('[extract-event][cron] Image fetch failed, using text only:', err.message);
      const completion = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: captionText },
        ],
      });
      extracted = JSON.parse(completion.choices?.[0]?.message?.content?.trim() ?? '{}');
    }
  } else {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: captionText },
      ],
    });
    extracted = JSON.parse(completion.choices?.[0]?.message?.content?.trim() ?? '{}');
  }

  if (!extracted.is_event) {
    console.log(`[extract-event] Post ${instagramPostId} is not an event — skipping.`);
    return null;
  }

  const row = {
    instagram_post_id: instagramPostId,
    instagram_shortcode: instagramShortcode,
    instagram_post_url: instagramPostUrl,
    title: extracted.title ?? null,
    date: extracted.date ?? null,
    time: extracted.time ?? null,
    end_time: extracted.end_time ?? null,
    description: extracted.description ?? null,
    location: extracted.location ?? null,
    image_url: extracted.image_url || imageUrl || null,
    registration_link: extracted.registration_link ?? null,
    tags: extracted.tags ?? [],
  };

  const { data, error } = await supabase
    .from('events')
    .upsert(row, { onConflict: 'instagram_post_id' })
    .select()
    .single();

  if (error) {
    console.error('[extract-event] Supabase upsert error:', error);
    throw error;
  }

  console.log(`[extract-event] Upserted event: "${row.title}" (${row.date})`);
  return data;
}

// ─── HTTP handler: accepts { imageBase64, mimeType } from admin UI ────────────
// Returns raw extraction result including crop field. Does NOT save to Supabase.
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { imageBase64, mimeType, caption } = body;

  if (!imageBase64 || !mimeType) {
    return new Response(JSON.stringify({ error: 'imageBase64 and mimeType are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
    const extracted    = await callOpenAI(imageDataUrl, caption || '');
    return new Response(JSON.stringify({ extracted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[extract-event] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
