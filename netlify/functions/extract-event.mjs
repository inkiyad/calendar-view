import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────
const ORG_NAME        = process.env.ORG_NAME        || 'your organization';
const ORG_DESCRIPTION = process.env.ORG_DESCRIPTION || 'a community center';
const ORG_ADDRESS = process.env.ORG_ADDRESS || '';
const EVENT_TAGS = process.env.EVENT_TAGS || 'lecture,youth,sisters,brothers,fundraiser,interfaith,community,free,ticketed';

const SYSTEM_PROMPT = `You are an event data extractor for ${ORG_NAME}, ${ORG_DESCRIPTION}${ORG_ADDRESS ? ' at ' + ORG_ADDRESS : ''}. Analyze the Instagram post image and caption. Return ONLY valid JSON — no markdown, no explanation. Schema: { "is_event": bool, "title": string, "date": "YYYY-MM-DD", "time": "H:MM AM/PM", "end_time": "H:MM AM/PM or null", "description": string (1-3 sentences), "location": string, "image_url": string, "registration_link": string or null, "tags": array from [${EVENT_TAGS}] }. Only extract events with a specific date. Set is_event: false for weather advisories, general announcements, or prayer schedules.`.trim();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Fetch an image from a URL and return it as a base64 data URI.
 * This is required for Instagram CDN URLs that OpenAI cannot fetch directly.
 *
 * @param {string} url
 * @returns {Promise<string|null>} A base64 data URI string, or null on failure.
 */
async function fetchImageAsBase64(url) {
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large: ${contentLength} bytes`);
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large after download: ${buffer.byteLength} bytes`);
    }

    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn('[extract-event] Could not fetch image as base64:', err.message);
    return null;
  }
}

/**
 * Core extraction logic — called by cron-poller and the manual POST handler.
 *
 * @param {object} post
 * @param {string} post.instagramPostId
 * @param {string} post.instagramShortcode
 * @param {string} post.instagramPostUrl
 * @param {string} post.imageUrl
 * @param {string} post.caption
 * @returns {Promise<object|null>} The upserted event row, or null if not an event.
 */
export async function extractEventFromPost(post) {
  const { instagramPostId, instagramShortcode, instagramPostUrl, imageUrl, caption } = post;

  // Build message content — fetch image as base64 so OpenAI can access Instagram CDN URLs
  const content = [];
  if (imageUrl) {
    const base64DataUri = await fetchImageAsBase64(imageUrl);
    if (base64DataUri) {
      content.push({
        type: 'image_url',
        image_url: { url: base64DataUri },
      });
    }
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
    extracted = JSON.parse(raw);
  } catch {
    console.error('[extract-event] OpenAI returned non-JSON:', raw);
    return null;
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
