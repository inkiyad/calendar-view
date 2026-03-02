import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Inlined so esbuild bundling doesn't break file-system reads
const ORG_NAME = process.env.ORG_NAME || 'your organization';
const ORG_DESCRIPTION = process.env.ORG_DESCRIPTION || 'a community center';
const ORG_ADDRESS = process.env.ORG_ADDRESS || '';
const EVENT_TAGS = process.env.EVENT_TAGS || 'lecture,youth,sisters,brothers,fundraiser,interfaith,community,free,ticketed';

const SYSTEM_PROMPT = `You are an event data extractor for ${ORG_NAME}, ${ORG_DESCRIPTION}${ORG_ADDRESS ? ' at ' + ORG_ADDRESS : ''}. Analyze the Instagram post image and caption. Return ONLY valid JSON — no markdown, no explanation. Schema: { "is_event": bool, "title": string, "date": "YYYY-MM-DD", "time": "H:MM AM/PM", "end_time": "H:MM AM/PM or null", "description": string (1-3 sentences), "location": string, "image_url": string, "registration_link": string or null, "tags": array from [${EVENT_TAGS}] }. Only extract events with a specific date. Set is_event: false for weather advisories, general announcements, or prayer schedules.`.trim();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

  // Build message content — include image if URL is available
  const content = [];
  if (imageUrl) {
    content.push({
      type: 'image',
      source: { type: 'url', url: imageUrl },
    });
  }
  content.push({
    type: 'text',
    text: `Instagram caption:\n\n${caption}\n\nPost URL: ${instagramPostUrl}`,
  });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  const raw = message.content?.[0]?.text?.trim() ?? '{}';

  let extracted;
  try {
    extracted = JSON.parse(raw);
  } catch {
    console.error('[extract-event] Claude returned non-JSON:', raw);
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

/**
 * Manual trigger — POST with JSON body matching the post shape above.
 */
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

  try {
    const result = await extractEventFromPost(body);
    return new Response(JSON.stringify({ event: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
