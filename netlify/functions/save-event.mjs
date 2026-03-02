import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

  const { eventData, croppedImageBase64, mimeType } = body;

  if (!eventData) {
    return new Response(JSON.stringify({ error: 'eventData is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let imageUrl = eventData.image_url || null;

    // Upload cropped image to Supabase Storage if provided
    if (croppedImageBase64 && mimeType) {
      const ext        = mimeType.split('/')[1] || 'jpg';
      const filename   = `event_${Date.now()}.${ext}`;
      const buffer     = Buffer.from(croppedImageBase64, 'base64');

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filename, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('[save-event] Storage upload error:', uploadError);
        // Non-fatal — continue without image
      } else {
        const { data: urlData } = supabase.storage
          .from('event-images')
          .getPublicUrl(filename);
        imageUrl = urlData.publicUrl;
        console.log('[save-event] Uploaded image:', imageUrl);
      }
    }

    // Build row — strip crop field, set image_url to storage URL
    const row = {
      title:             eventData.title             ?? null,
      date:              eventData.date              ?? null,
      time:              eventData.time              ?? null,
      end_time:          eventData.end_time          ?? null,
      description:       eventData.description       ?? null,
      location:          eventData.location          ?? null,
      image_url:         imageUrl,
      registration_link: eventData.registration_link ?? null,
      tags:              eventData.tags              ?? [],
      // Leave instagram fields null for manually-added events
      instagram_post_id:   eventData.instagram_post_id   || null,
      instagram_shortcode: eventData.instagram_shortcode || null,
      instagram_post_url:  eventData.instagram_post_url  || null,
    };

    const { data, error } = await supabase
      .from('events')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[save-event] Supabase insert error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[save-event] Saved event: "${row.title}" (${row.date})`);
    return new Response(JSON.stringify({ success: true, event: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[save-event] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
