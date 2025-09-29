export default {
  async fetch(request, _env, _ctx) {
    const url = new URL(request.url);

    // 简单CORS（按需收紧）
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/api/health' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          runtime: 'cloudflare-worker',
          timestamp: new Date().toISOString()
        }),
        { headers: { 'content-type': 'application/json', ...corsHeaders } }
      );
    }

    if (url.pathname === '/api/crawl') {
      try {
        let targetUrl = url.searchParams.get('url') || '';
        if (!targetUrl && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          targetUrl = body.url || '';
        }
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: 'missing url' }), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } });
        }

        const timeoutMs = 8000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const resp = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          redirect: 'follow'
        });
        clearTimeout(timeoutId);

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: `HTTP ${resp.status}` }), { status: resp.status, headers: { 'content-type': 'application/json', ...corsHeaders } });
        }

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          return new Response(JSON.stringify({ error: `Not HTML: ${contentType}` }), { status: 415, headers: { 'content-type': 'application/json', ...corsHeaders } });
        }

        const html = await resp.text();
        const limited = html.slice(0, 16384);

        const titleMatch = limited.match(/<title[^>]*>([^<]*)<\/title>/i);
        const getMeta = (attr, value) => {
          const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"]*)["'][^>]*>`, 'i');
          const m = limited.match(re);
          return m?.[1]?.trim() || '';
        };

        const result = {
          status: resp.status,
          finalUrl: resp.url,
          title: titleMatch?.[1]?.trim() || '',
          description: getMeta('name', 'description').substring(0, 500),
          keywords: getMeta('name', 'keywords').substring(0, 300),
          ogTitle: getMeta('property', 'og:title'),
          ogDescription: getMeta('property', 'og:description').substring(0, 500),
          ogImage: getMeta('property', 'og:image'),
          ogSiteName: getMeta('property', 'og:site_name')
        };

        return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', ...corsHeaders } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
