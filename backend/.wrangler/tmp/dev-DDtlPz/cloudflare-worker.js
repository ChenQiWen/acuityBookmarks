var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// cloudflare-worker.js
var DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
var DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-m3";
var DEFAULT_TEMPERATURE = 0.6;
var DEFAULT_MAX_TOKENS = 256;
var CRAWL_TIMEOUT_MS = 8e3;
var HTML_SLICE_LIMIT = 16384;
var STATUS_UNSUPPORTED_MEDIA_TYPE = 415;
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";
var ACCEPT_HTML = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
var MIN_EMBED_TEXT_LENGTH = 3;
var corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};
var okJson = /* @__PURE__ */ __name((data) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json", ...corsHeaders } }), "okJson");
var errorJson = /* @__PURE__ */ __name((data, status = 500) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...corsHeaders } }), "errorJson");
function handleOptions() {
  return new Response(null, { headers: corsHeaders });
}
__name(handleOptions, "handleOptions");
function handleHealth() {
  return okJson({ status: "ok", runtime: "cloudflare-worker", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
}
__name(handleHealth, "handleHealth");
async function handleAIComplete(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const prompt = url.searchParams.get("prompt") || body.prompt || "";
    const messages = body.messages || void 0;
    const stream = body.stream === true || url.searchParams.get("stream") === "true";
    const model = body.model || url.searchParams.get("model") || DEFAULT_MODEL;
    const temperature = body.temperature ?? DEFAULT_TEMPERATURE;
    const max_tokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;
    if (!prompt && !Array.isArray(messages)) return errorJson({ error: "missing prompt or messages" }, 400);
    const params = Array.isArray(messages) && messages.length > 0 ? { messages, stream, temperature, max_tokens } : { prompt, stream, temperature, max_tokens };
    const answer = await env.AI.run(model, params);
    if (stream) return new Response(answer, { headers: { "content-type": "text/event-stream", ...corsHeaders } });
    return okJson(answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAIComplete, "handleAIComplete");
async function handleAIEmbedding(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const text = url.searchParams.get("text") || body.text || "";
    const model = body.model || url.searchParams.get("model") || DEFAULT_EMBEDDING_MODEL;
    if (!text) return errorJson({ error: "missing text" }, 400);
    const trimmed = text.trim();
    if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
      return errorJson({
        error: "text too short",
        details: { minTextLength: MIN_EMBED_TEXT_LENGTH, actualLength: trimmed.length }
      }, 400);
    }
    const vector = await generateEmbeddingVector(env, model, trimmed);
    if (!Array.isArray(vector) || vector.length === 0) {
      return errorJson({
        error: "embedding generation produced empty vector",
        details: { model, textLength: trimmed.length }
      }, 500);
    }
    return okJson({ vector, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleAIEmbedding, "handleAIEmbedding");
async function handleVectorizeUpsert(request, env) {
  try {
    if (request.method !== "POST") return errorJson({ error: "Method not allowed" }, 405);
    const body = await request.json().catch(() => ({}));
    const vectors = Array.isArray(body?.vectors) ? body.vectors : [];
    if (!vectors.length) return errorJson({ error: "missing vectors" }, 400);
    const normalized = vectors.map((v) => ({
      id: String(v.id),
      values: Array.isArray(v.values) ? v.values : Array.isArray(v.vector) ? v.vector : [],
      metadata: v.metadata || {}
    })).filter((v) => Array.isArray(v.values) && v.values.length > 0 && v.id);
    if (!normalized.length) return errorJson({ error: "no valid vectors" }, 400);
    const result = await env.VECTORIZE.upsert(normalized);
    return okJson({ success: true, mutation: result?.mutation || result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleVectorizeUpsert, "handleVectorizeUpsert");
async function handleVectorizeQuery(request, env) {
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const text = url.searchParams.get("text") || body.text || "";
    const vector = Array.isArray(body.vector) ? body.vector : void 0;
    const topK = Number(url.searchParams.get("topK") || body.topK || 10);
    const returnMetadata = body.returnMetadata || url.searchParams.get("returnMetadata") || "indexed";
    const returnValues = body.returnValues === true || url.searchParams.get("returnValues") === "true";
    const modelOverride = body.model || url.searchParams.get("model") || void 0;
    let queryVector = vector;
    if (!queryVector) {
      if (!text) return errorJson({ error: "missing text or vector" }, 400);
      const trimmed = text.trim();
      if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
        return errorJson({
          error: "text too short for embedding",
          details: { minTextLength: MIN_EMBED_TEXT_LENGTH, actualLength: trimmed.length }
        }, 400);
      }
      const model = modelOverride || DEFAULT_EMBEDDING_MODEL;
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
        error: "embedding generation produced empty vector",
        details: { textLength: (text || "").trim().length }
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
__name(handleVectorizeQuery, "handleVectorizeQuery");
async function handleCrawl(request) {
  try {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get("url") || "";
    if (!targetUrl && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      targetUrl = body.url || "";
    }
    if (!targetUrl) return errorJson({ error: "missing url" }, 400);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);
    const resp = await fetch(targetUrl, { signal: controller.signal, headers: { "User-Agent": UA, "Accept": ACCEPT_HTML }, redirect: "follow" });
    clearTimeout(timeoutId);
    if (!resp.ok) return errorJson({ error: `HTTP ${resp.status}` }, resp.status);
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return errorJson({ error: `Not HTML: ${contentType}` }, STATUS_UNSUPPORTED_MEDIA_TYPE);
    const html = await resp.text();
    const limited = html.slice(0, HTML_SLICE_LIMIT);
    const titleMatch = limited.match(/<title[^>]*>([^<]*)<\/title>/i);
    const getMeta = /* @__PURE__ */ __name((attr, value) => {
      const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"]*)["'][^>]*>`, "i");
      const m = limited.match(re);
      return m?.[1]?.trim() || "";
    }, "getMeta");
    return okJson({
      status: resp.status,
      finalUrl: resp.url,
      title: titleMatch?.[1]?.trim() || "",
      description: getMeta("name", "description").substring(0, 500),
      keywords: getMeta("name", "keywords").substring(0, 300),
      ogTitle: getMeta("property", "og:title"),
      ogDescription: getMeta("property", "og:description").substring(0, 500),
      ogImage: getMeta("property", "og:image"),
      ogSiteName: getMeta("property", "og:site_name")
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return errorJson({ error: msg }, 500);
  }
}
__name(handleCrawl, "handleCrawl");
var cloudflare_worker_default = {
  fetch(request, env, _ctx) {
    if (request.method === "OPTIONS") return handleOptions();
    const url = new URL(request.url);
    if (url.pathname === "/api/health" || url.pathname === "/health") return handleHealth();
    if (url.pathname === "/api/ai/complete") return handleAIComplete(request, env);
    if (url.pathname === "/api/ai/embedding") return handleAIEmbedding(request, env);
    if (url.pathname === "/api/vectorize/upsert") return handleVectorizeUpsert(request, env);
    if (url.pathname === "/api/vectorize/query") return handleVectorizeQuery(request, env);
    if (url.pathname === "/api/crawl") return handleCrawl(request);
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
function extractEmbeddingVector(answer) {
  if (!answer) return void 0;
  if (Array.isArray(answer)) return answer;
  if (Array.isArray(answer.data)) {
    const first = answer.data[0];
    if (Array.isArray(first)) return first;
    if (first && Array.isArray(first.embedding)) return first.embedding;
    if (typeof answer.data[0] === "number") return answer.data;
  }
  if (Array.isArray(answer.embeddings)) {
    const e0 = answer.embeddings[0];
    return Array.isArray(e0) ? e0 : answer.embeddings;
  }
  if (Array.isArray(answer.embedding)) return answer.embedding;
  return void 0;
}
__name(extractEmbeddingVector, "extractEmbeddingVector");
async function generateEmbeddingVector(env, model, text) {
  const emb = await env.AI.run(model, { text });
  return extractEmbeddingVector(emb);
}
__name(generateEmbeddingVector, "generateEmbeddingVector");

// ../../../../.bun/install/global/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-P9MNj6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = cloudflare_worker_default;

// ../../../../.bun/install/global/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-P9MNj6/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-worker.js.map
