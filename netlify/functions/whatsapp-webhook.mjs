import crypto from 'crypto';
import { readFile } from 'fs/promises';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0';
const SEND_CONFIRMATIONS = process.env.WHATSAPP_SEND_CONFIRMATIONS === 'true';
const BOOTSTRAP_ALLOWED_SENDERS = (process.env.WHATSAPP_ALLOWED_SENDERS || '')
  .split(',')
  .map((sender) => sender.replace(/\D/g, ''))
  .filter(Boolean);
const TRUSTED_SENDERS_KEY = 'whatsapp_trusted_senders';

const ORG_NAME = process.env.ORG_NAME || 'MAS Queens Center';
const ORG_DESCRIPTION = process.env.ORG_DESCRIPTION || 'a Muslim community center';
const ORG_ADDRESS = process.env.ORG_ADDRESS || '46-01 20th Ave, Astoria, NY 11105';
const EVENT_TAGS = process.env.EVENT_TAGS || 'lecture,youth,sisters,brothers,fundraiser,interfaith,quran,community,free,ticketed';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';
const WHATSAPP_PROMPT_PATH = new URL('../../prompts/whatsapp-event-extraction.txt', import.meta.url);

let openai;
let supabase;
let promptTemplate;

function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

async function getPromptTemplate() {
  if (!promptTemplate) {
    promptTemplate = await readFile(WHATSAPP_PROMPT_PATH, 'utf8');
  }
  return promptTemplate;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidSignature(rawBody, signatureHeader) {
  if (!APP_SECRET) return true;
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '').trim();

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(provided, 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function getMessagesFromPayload(payload) {
  const messages = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id || '';
      const contactsByWaId = new Map(
        (value?.contacts || []).map((contact) => [contact.wa_id, contact])
      );

      for (const message of value?.messages || []) {
        messages.push({
          message,
          phoneNumberId,
          contact: contactsByWaId.get(message.from) || null,
        });
      }
    }
  }

  return messages;
}

function getInboundContent(message) {
  if (message.type === 'image' && message.image?.id) {
    return {
      mediaId: message.image.id,
      mimeType: message.image.mime_type || 'image/jpeg',
      caption: message.image.caption || '',
      text: message.image.caption || '',
      mediaKind: 'image',
    };
  }

  if (message.type === 'document' && message.document?.id) {
    return {
      mediaId: message.document.id,
      mimeType: message.document.mime_type || '',
      caption: message.document.caption || message.document.filename || '',
      text: message.document.caption || message.document.filename || '',
      mediaKind: 'document',
    };
  }

  if (message.type === 'text' && message.text?.body) {
    return {
      mediaId: null,
      mimeType: '',
      caption: '',
      text: message.text.body,
      mediaKind: 'text',
    };
  }

  return {
    mediaId: null,
    mimeType: '',
    caption: '',
    text: '',
    mediaKind: message.type || 'unknown',
  };
}

function normalizeWaId(value) {
  return String(value || '').replace(/\D/g, '');
}

async function getTrustedSenders() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return [...new Set(BOOTSTRAP_ALLOWED_SENDERS)];
  }

  const { data, error } = await getSupabase()
    .from('processing_state')
    .select('value')
    .eq('key', TRUSTED_SENDERS_KEY)
    .maybeSingle();

  if (error) throw error;

  const storedSenders = (data?.value || '')
    .split(',')
    .map(normalizeWaId)
    .filter(Boolean);

  return [...new Set([...BOOTSTRAP_ALLOWED_SENDERS, ...storedSenders])];
}

async function isAllowedSender(waId) {
  const allowedSenders = await getTrustedSenders();
  if (allowedSenders.length === 0) return false;
  return allowedSenders.includes(normalizeWaId(waId));
}

async function addTrustedSender(waId) {
  const normalized = normalizeWaId(waId);
  if (!normalized) return [];

  const nextSenders = [...new Set([...(await getTrustedSenders()), normalized])].sort();
  const { error } = await getSupabase()
    .from('processing_state')
    .upsert({
      key: TRUSTED_SENDERS_KEY,
      value: nextSenders.join(','),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
  return nextSenders;
}

function parseTrustCommand(text) {
  const match = String(text || '').match(/^\s*(?:trust|add trusted|add sender|allow)\s+(\+?\d[\d\s().-]{6,})\s*$/i);
  if (!match) return null;
  return normalizeWaId(match[1]);
}

async function fetchWhatsAppMedia(mediaId) {
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is required to download WhatsApp media');
  }

  const metadataUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`;
  const metadataResponse = await fetch(metadataUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });

  if (!metadataResponse.ok) {
    throw new Error(`WhatsApp media metadata fetch failed: ${metadataResponse.status}`);
  }

  const metadata = await metadataResponse.json();
  if (!metadata.url) {
    throw new Error('WhatsApp media metadata did not include a download URL');
  }

  const mediaResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });

  if (!mediaResponse.ok) {
    throw new Error(`WhatsApp media download failed: ${mediaResponse.status}`);
  }

  const arrayBuffer = await mediaResponse.arrayBuffer();
  const contentType =
    mediaResponse.headers.get('content-type') ||
    metadata.mime_type ||
    'application/octet-stream';

  return {
    base64: Buffer.from(arrayBuffer).toString('base64'),
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => values[key] ?? '');
}

async function buildExtractionPrompt(message, contact, inboundText) {
  const now = new Date().toISOString();
  const newYorkNow = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'America/New_York',
  }).format(new Date());
  const senderName = contact?.profile?.name || 'Unknown sender';
  const template = await getPromptTemplate();

  return fillTemplate(template, {
    ORG_NAME,
    ORG_DESCRIPTION,
    ORG_ADDRESS_PHRASE: ORG_ADDRESS ? ` at ${ORG_ADDRESS}` : '',
    CURRENT_ISO: now,
    CURRENT_NEW_YORK: newYorkNow,
    SENDER_NAME: senderName,
    SENDER_ID: message.from || '',
    MESSAGE_TIMESTAMP: message.timestamp || '',
    MESSAGE_TEXT: inboundText || '(none)',
    EVENT_TAGS,
    DEFAULT_LOCATION: ORG_ADDRESS || ORG_NAME,
  });
}

async function extractEvent({ message, contact, inboundText, imageDataUrl }) {
  const content = [];
  if (imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  }
  content.push({ type: 'text', text: await buildExtractionPrompt(message, contact, inboundText) });

  const completion = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content }],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
  console.log('[whatsapp-webhook] OpenAI raw response:', raw);

  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return JSON.parse(fenceMatch ? fenceMatch[1].trim() : raw);
}

function extensionForMimeType(mimeType) {
  const subtype = (mimeType || '').split('/')[1] || 'jpg';
  return subtype.replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
}

function safeFilePart(value) {
  return String(value || 'message').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
}

async function uploadEventImage({ messageId, media }) {
  if (!media?.buffer || !media?.contentType?.startsWith('image/')) return null;

  const ext = extensionForMimeType(media.contentType);
  const filename = `whatsapp_${safeFilePart(messageId)}_${Date.now()}.${ext}`;

  const { error } = await getSupabase().storage
    .from('event-images')
    .upload(filename, media.buffer, {
      contentType: media.contentType,
      upsert: false,
    });

  if (error) {
    console.error('[whatsapp-webhook] Storage upload error:', error);
    return null;
  }

  const { data } = getSupabase().storage.from('event-images').getPublicUrl(filename);
  return data.publicUrl;
}

async function hasProcessedMessage(messageId) {
  const { data, error } = await getSupabase()
    .from('processing_state')
    .select('value')
    .eq('key', `whatsapp_message:${messageId}`)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function markProcessedMessage(messageId, value) {
  const { error } = await getSupabase()
    .from('processing_state')
    .upsert({
      key: `whatsapp_message:${messageId}`,
      value,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

async function saveExtractedEvent({ extracted, imageUrl, message, contact }) {
  const row = {
    instagram_post_id: null,
    instagram_shortcode: null,
    instagram_post_url: null,
    title: extracted.title ?? null,
    date: extracted.date ?? null,
    time: extracted.time ?? null,
    end_time: extracted.end_time ?? null,
    description: extracted.description ?? null,
    location: extracted.location ?? null,
    image_url: imageUrl || extracted.image_url || null,
    registration_link: extracted.registration_link ?? null,
    tags: extracted.tags ?? [],
  };

  const { data, error } = await getSupabase()
    .from('events')
    .insert(row)
    .select()
    .single();

  if (error) throw error;

  console.log(
    `[whatsapp-webhook] Saved WhatsApp event "${row.title}" from ${contact?.profile?.name || message.from}`
  );
  return data;
}

async function sendWhatsAppText({ phoneNumberId, to, body }) {
  if (!SEND_CONFIRMATIONS || !WHATSAPP_ACCESS_TOKEN || !phoneNumberId || !to) return;

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { preview_url: false, body },
        }),
      }
    );

    if (!response.ok) {
      console.warn('[whatsapp-webhook] Confirmation send failed:', response.status);
    }
  } catch (error) {
    console.warn('[whatsapp-webhook] Confirmation send error:', error.message);
  }
}

async function processMessage({ message, phoneNumberId, contact }) {
  if (!message?.id) return { skipped: true, reason: 'missing_message_id' };

  const inbound = getInboundContent(message);
  const trustedSenderToAdd = parseTrustCommand(inbound.text);

  if (!(await isAllowedSender(message.from))) {
    console.warn('[whatsapp-webhook] Unauthorized sender ignored:', message.from);
    await sendWhatsAppText({
      phoneNumberId,
      to: message.from,
      body: 'This MAS Queens calendar intake number only accepts event submissions from approved senders.',
    });
    return { skipped: true, reason: 'unauthorized_sender' };
  }

  if (trustedSenderToAdd) {
    await addTrustedSender(trustedSenderToAdd);
    await markProcessedMessage(message.id, `trusted_sender:${trustedSenderToAdd}`);
    await sendWhatsAppText({
      phoneNumberId,
      to: message.from,
      body: `Added ${trustedSenderToAdd} as a trusted MAS Queens calendar sender.`,
    });
    return { skipped: false, command: 'trust', trustedSender: trustedSenderToAdd };
  }

  if (await hasProcessedMessage(message.id)) {
    console.log('[whatsapp-webhook] Duplicate message ignored:', message.id);
    return { skipped: true, reason: 'duplicate' };
  }

  if (!inbound.text && !inbound.mediaId) {
    await markProcessedMessage(message.id, `ignored:${inbound.mediaKind}`);
    return { skipped: true, reason: `unsupported_${inbound.mediaKind}` };
  }

  let media = null;
  let imageDataUrl = null;

  if (inbound.mediaId) {
    media = await fetchWhatsAppMedia(inbound.mediaId);
    if (!media.contentType.startsWith('image/')) {
      await markProcessedMessage(message.id, `ignored:${media.contentType}`);
      return { skipped: true, reason: `unsupported_media_${media.contentType}` };
    }
    imageDataUrl = `data:${media.contentType};base64,${media.base64}`;
  }

  const extracted = await extractEvent({
    message,
    contact,
    inboundText: inbound.text,
    imageDataUrl,
  });

  if (!extracted.is_event) {
    await markProcessedMessage(message.id, 'non_event');
    await sendWhatsAppText({
      phoneNumberId,
      to: message.from,
      body: "Thanks. I couldn't identify a dated event in that message, so I did not add it to the calendar.",
    });
    return { skipped: true, reason: 'non_event' };
  }

  const imageUrl = await uploadEventImage({ messageId: message.id, media });
  const event = await saveExtractedEvent({ extracted, imageUrl, message, contact });
  await markProcessedMessage(message.id, `event:${event.id}`);

  await sendWhatsAppText({
    phoneNumberId,
    to: message.from,
    body: `Added to the MAS Queens calendar: ${event.title} on ${event.date}${event.time ? ` at ${event.time}` : ''}.`,
  });

  return { saved: true, eventId: event.id };
}

export default async function handler(req) {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
      return new Response(challenge || '', { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') || '';

  if (!isValidSignature(rawBody, signature)) {
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const inboundMessages = getMessagesFromPayload(payload);
  if (inboundMessages.length === 0) {
    return jsonResponse({ ok: true, processed: 0 });
  }

  const results = [];
  for (const inbound of inboundMessages) {
    try {
      results.push(await processMessage(inbound));
    } catch (error) {
      console.error('[whatsapp-webhook] Message processing error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }

  return jsonResponse({ ok: true, processed: results.length, results });
}
