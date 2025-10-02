// 提取常量以消除 magic numbers 并降低复杂度
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const DEFAULT_TEMPERATURE = 0.6;
const DEFAULT_MAX_TOKENS = 256;
const CRAWL_TIMEOUT_MS = 8000;
const HTML_SLICE_LIMIT = 16384;
const STATUS_UNSUPPORTED_MEDIA_TYPE = 415;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
const ACCEPT_HTML = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
// 最小嵌入文本长度（短文本直接返回 400 校验失败）
const MIN_EMBED_TEXT_LENGTH = 3;

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

const okJson = (data) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', ...corsHeaders } });
const errorJson = (data, status = 500) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...corsHeaders } });

function handleOptions() { return new Response(null, { headers: corsHeaders }); }

function handleHealth() {
  return okJson({ status: 'ok', runtime: 'cloudflare-worker', timestamp: new Date().toISOString() });
}

async function handleAIComplete(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const prompt = url.searchParams.get('prompt') || body.prompt || '';
    const messages = body.messages || undefined;
    const stream = body.stream === true || url.searchParams.get('stream') === 'true';
    const model = body.model || url.searchParams.get('model') || DEFAULT_MODEL;
    const temperature = body.temperature ?? DEFAULT_TEMPERATURE;
    const max_tokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;

    if (!prompt && !Array.isArray(messages)) return errorJson({ error: 'missing prompt or messages' }, 400);

    const params = Array.isArray(messages) && messages.length > 0
      ? { messages, stream, temperature, max_tokens }
      : { prompt, stream, temperature, max_tokens };

    const answer = await env.AI.run(model, params);
    if (stream) return new Response(answer, { headers: { 'content-type': 'text/event-stream', ...corsHeaders } });
    return okJson(answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}

async function handleAIEmbedding(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const text = url.searchParams.get('text') || body.text || '';
    const model = body.model || url.searchParams.get('model') || DEFAULT_EMBEDDING_MODEL;
    if (!text) return errorJson({ error: 'missing text' }, 400);
    const trimmed = text.trim();
    if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
      return errorJson({
        error: 'text too short',
        details: { minTextLength: MIN_EMBED_TEXT_LENGTH, actualLength: trimmed.length }
      }, 400);
    }

    const vector = await generateEmbeddingVector(env, model, trimmed);

    if (!Array.isArray(vector) || vector.length === 0) {
      return errorJson({
        error: 'embedding generation produced empty vector',
        details: { model, textLength: trimmed.length }
      }, 500);
    }
    return okJson({ vector, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}

// === Vectorize 集成：向量 upsert / 查询 ===
async function handleVectorizeUpsert(request, env) {
  try {
    if (request.method !== 'POST') return errorJson({ error: 'Method not allowed' }, 405);
    const body = await request.json().catch(() => ({}));
    const vectors = Array.isArray(body?.vectors) ? body.vectors : [];
    if (!vectors.length) return errorJson({ error: 'missing vectors' }, 400);

    // 规范化输入
    const normalized = vectors.map(v => ({
      id: String(v.id),
      values: Array.isArray(v.values) ? v.values : (Array.isArray(v.vector) ? v.vector : []),
      metadata: v.metadata || {}
    })).filter(v => Array.isArray(v.values) && v.values.length > 0 && v.id);

    if (!normalized.length) return errorJson({ error: 'no valid vectors' }, 400);

    const result = await env.VECTORIZE.upsert(normalized);
    return okJson({ success: true, mutation: result?.mutation || result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}

async function handleVectorizeQuery(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const text = url.searchParams.get('text') || body.text || '';
    const vector = Array.isArray(body.vector) ? body.vector : undefined;
    const topK = Number(url.searchParams.get('topK') || body.topK || 10);
    const returnMetadata = body.returnMetadata || url.searchParams.get('returnMetadata') || 'indexed';
    const returnValues = body.returnValues === true || url.searchParams.get('returnValues') === 'true';

    let queryVector = vector;
    if (!queryVector) {
      if (!text) return errorJson({ error: 'missing text or vector' }, 400);
      const trimmed = text.trim();
      if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
        return errorJson({
          error: 'text too short for embedding',
          details: { minTextLength: MIN_EMBED_TEXT_LENGTH, actualLength: trimmed.length }
        }, 400);
      }
      const model = DEFAULT_EMBEDDING_MODEL;
      try {
        queryVector = await generateEmbeddingVector(env, model, trimmed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return errorJson({
          error: `embedding generation failed: ${msg}`,
          details: { model, textLength: trimmed.length }
        }, 500);
      }
    }

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return errorJson({
        error: 'embedding generation produced empty vector',
        details: { textLength: (text || '').trim().length }
      }, 500);
    }

    let matches;
    try {
      matches = await env.VECTORIZE.query(queryVector, {
        topK,
        returnMetadata,
        returnValues
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return errorJson({
        error: `vectorize query failed: ${msg}`,
        details: { topK, returnMetadata, returnValues }
      }, 500);
    }

    return okJson({ success: true, matches });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}

async function handleCrawl(request) {
  try {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url') || '';
    if (!targetUrl && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      targetUrl = body.url || '';
    }
    if (!targetUrl) return errorJson({ error: 'missing url' }, 400);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);
    const resp = await fetch(targetUrl, { signal: controller.signal, headers: { 'User-Agent': UA, 'Accept': ACCEPT_HTML }, redirect: 'follow' });
    clearTimeout(timeoutId);

    if (!resp.ok) return errorJson({ error: `HTTP ${resp.status}` }, resp.status);
    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return errorJson({ error: `Not HTML: ${contentType}` }, STATUS_UNSUPPORTED_MEDIA_TYPE);

    const html = await resp.text();
    const limited = html.slice(0, HTML_SLICE_LIMIT);
    const titleMatch = limited.match(/<title[^>]*>([^<]*)<\/title>/i);
    const getMeta = (attr, value) => {
      const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"]*)["'][^>]*>`, 'i');
      const m = limited.match(re);
      return m?.[1]?.trim() || '';
    };

    return okJson({
      status: resp.status,
      finalUrl: resp.url,
      title: titleMatch?.[1]?.trim() || '',
      description: getMeta('name', 'description').substring(0, 500),
      keywords: getMeta('name', 'keywords').substring(0, 300),
      ogTitle: getMeta('property', 'og:title'),
      ogDescription: getMeta('property', 'og:description').substring(0, 500),
      ogImage: getMeta('property', 'og:image'),
      ogSiteName: getMeta('property', 'og:site_name')
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}

// 已移除：服务端随机计算测试相关逻辑

export default {
  fetch(request, env, _ctx) {
    if (request.method === 'OPTIONS') return handleOptions();
    const url = new URL(request.url);
    if (url.pathname === '/api/health' || url.pathname === '/health') return handleHealth();
    if (url.pathname === '/api/ai/complete') return handleAIComplete(request, env);
    if (url.pathname === '/api/ai/embedding') return handleAIEmbedding(request, env);
    if (url.pathname === '/api/vectorize/upsert') return handleVectorizeUpsert(request, env);
    if (url.pathname === '/api/vectorize/query') return handleVectorizeQuery(request, env);
    if (url.pathname === '/api/crawl') return handleCrawl(request);
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
// === Embedding 解析助手：统一从多种返回结构提取向量 ===
function extractEmbeddingVector(answer) {
  if (!answer) return undefined;
  // 直接数组
  if (Array.isArray(answer)) return answer;
  // Cloudflare 文档：{ data: [vector] }
  if (Array.isArray(answer.data)) {
    const first = answer.data[0];
    if (Array.isArray(first)) return first;
    if (first && Array.isArray(first.embedding)) return first.embedding; // OpenAI兼容
    // 某些返回可能直接是 data: vector
    if (typeof answer.data[0] === 'number') return answer.data;
  }
  // 其他字段：embeddings 或 embedding
  if (Array.isArray(answer.embeddings)) {
    const e0 = answer.embeddings[0];
    return Array.isArray(e0) ? e0 : answer.embeddings;
  }
  if (Array.isArray(answer.embedding)) return answer.embedding;
  return undefined;
}

async function generateEmbeddingVector(env, model, text) {
  const emb = await env.AI.run(model, { text });
  return extractEmbeddingVector(emb);
}
