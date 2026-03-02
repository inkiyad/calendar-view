import { createClient } from '@supabase/supabase-js';
import { extractEventFromPost } from './extract-event.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const INSTAGRAM_HANDLE = process.env.INSTAGRAM_HANDLE;

if (!INSTAGRAM_HANDLE) {
  throw new Error('INSTAGRAM_HANDLE environment variable is required');
}
// Public Instagram graph endpoint (basic display / scraper-compatible)
const IG_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/?__a=1&__d=dis`;

export default async function handler(req) {
  console.log(`[cron-poller] Running for @${INSTAGRAM_HANDLE}`);

  // Retrieve last processed post ID
  const { data: stateRow } = await supabase
    .from('processing_state')
    .select('value')
    .eq('key', 'last_instagram_post_id')
    .maybeSingle();

  const lastPostId = stateRow?.value ?? null;

  // Fetch recent posts from Instagram
  let posts = [];
  try {
    const res = await fetch(IG_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`Instagram fetch failed: ${res.status}`);
    const json = await res.json();

    // Handle both legacy and current JSON shapes
    const edges =
      json?.graphql?.user?.edge_owner_to_timeline_media?.edges ||
      json?.data?.user?.edge_owner_to_timeline_media?.edges ||
      [];

    posts = edges.map((e) => ({
      id: e.node.id,
      shortcode: e.node.shortcode,
      url: `https://www.instagram.com/p/${e.node.shortcode}/`,
      imageUrl:
        e.node.display_url ||
        e.node.thumbnail_src ||
        e.node?.edge_media_to_thumbnail?.edges?.[0]?.node?.src ||
        '',
      caption: e.node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
      timestamp: e.node.taken_at_timestamp,
    }));
  } catch (err) {
    console.error('[cron-poller] Could not fetch Instagram posts:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  // Filter to only posts from the last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentPosts = posts.filter(p => p.timestamp * 1000 >= thirtyDaysAgo);
  
  console.log(`[cron-poller] Found ${posts.length} total posts, ${recentPosts.length} from last 30 days`);

  // Filter to only posts newer than the last processed one
  let newPosts = recentPosts;
  if (lastPostId) {
    const lastIdx = recentPosts.findIndex((p) => p.id === lastPostId);
    newPosts = lastIdx === -1 ? recentPosts : recentPosts.slice(0, lastIdx);
  }

  if (newPosts.length === 0) {
    console.log('[cron-poller] No new posts found.');
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  console.log(`[cron-poller] Processing ${newPosts.length} new post(s)`);

  let processed = 0;
  for (const post of newPosts) {
    try {
      await extractEventFromPost({
        instagramPostId: post.id,
        instagramShortcode: post.shortcode,
        instagramPostUrl: post.url,
        imageUrl: post.imageUrl,
        caption: post.caption,
      });
      processed++;
    } catch (err) {
      console.error(`[cron-poller] Failed on post ${post.id}:`, err.message);
    }
  }

  // Persist the newest post ID as the new watermark
  const newestId = newPosts[0].id;
  await supabase
    .from('processing_state')
    .upsert({ key: 'last_instagram_post_id', value: newestId, updated_at: new Date().toISOString() });

  console.log(`[cron-poller] Done. Processed ${processed}/${newPosts.length} posts.`);
  return new Response(JSON.stringify({ processed }), { status: 200 });
}
