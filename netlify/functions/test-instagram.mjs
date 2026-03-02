/**
 * Test endpoint to verify Instagram fetching
 * GET /.netlify/functions/test-instagram
 * Returns raw Instagram posts without processing
 */

const INSTAGRAM_HANDLE = process.env.INSTAGRAM_HANDLE;

if (!INSTAGRAM_HANDLE) {
  throw new Error('INSTAGRAM_HANDLE environment variable is required');
}

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Try multiple endpoint variations
  const endpoints = [
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${INSTAGRAM_HANDLE}`,
    `https://www.instagram.com/${INSTAGRAM_HANDLE}/?__a=1&__d=dis`,
    `https://www.instagram.com/${INSTAGRAM_HANDLE}/?__a=1`,
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${INSTAGRAM_HANDLE}`,
  ];

  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
  };

  let lastError = null;
  
  for (const url of endpoints) {
    try {
      console.log(`[test-instagram] Trying: ${url}`);
      
      const res = await fetch(url, { headers: fetchHeaders });
      
      if (!res.ok) {
        const text = await res.text();
        lastError = {
          url,
          status: res.status,
          statusText: res.statusText,
          body: text.substring(0, 500), // First 500 chars for debugging
        };
        console.log(`[test-instagram] Failed with ${res.status}: ${text.substring(0, 200)}`);
        continue;
      }

      const json = await res.json();

      // Try to extract posts from various response structures
      let edges = null;
      
      // New API format
      if (json?.data?.user?.edge_owner_to_timeline_media?.edges) {
        edges = json.data.user.edge_owner_to_timeline_media.edges;
      }
      // Old API format
      else if (json?.graphql?.user?.edge_owner_to_timeline_media?.edges) {
        edges = json.graphql.user.edge_owner_to_timeline_media.edges;
      }
      // web_profile_info format
      else if (json?.data?.user?.edge_owner_to_timeline_media?.edges) {
        edges = json.data.user.edge_owner_to_timeline_media.edges;
      }

      if (!edges || edges.length === 0) {
        lastError = {
          url,
          message: 'No posts found in response',
          responseKeys: Object.keys(json),
        };
        continue;
      }

      const posts = edges.map((e) => ({
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
        date: new Date(e.node.taken_at_timestamp * 1000).toISOString(),
      }));

      console.log(`[test-instagram] ✓ Success! Found ${posts.length} posts from ${url}`);

      return new Response(
        JSON.stringify({
          success: true,
          handle: INSTAGRAM_HANDLE,
          endpoint: url,
          count: posts.length,
          posts: posts,
        }, null, 2),
        { status: 200, headers }
      );

    } catch (err) {
      lastError = { url, error: err.message };
      console.error(`[test-instagram] Error with ${url}:`, err.message);
      continue;
    }
  }

  // All endpoints failed
  return new Response(
    JSON.stringify({ 
      success: false,
      handle: INSTAGRAM_HANDLE,
      message: 'All Instagram endpoints failed',
      attempts: endpoints.length,
      lastError,
      note: 'Instagram may be blocking automated requests. Consider using Instagram Basic Display API or official Instagram Graph API instead.'
    }, null, 2),
    { status: 500, headers }
  );
}
