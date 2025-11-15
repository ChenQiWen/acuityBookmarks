import type {
  Ai,
  VectorizeIndex,
  ExecutionContext
} from '@cloudflare/workers-types'

export interface Env {
  // Bindings
  AI: Ai
  VECTORIZE: VectorizeIndex

  // Secrets & Vars from wrangler.toml
  JWT_SECRET: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string

  AUTH_GOOGLE_CLIENT_ID?: string
  AUTH_GOOGLE_CLIENT_SECRET?: string
  AUTH_MICROSOFT_CLIENT_ID?: string
  AUTH_MICROSOFT_CLIENT_SECRET?: string

  GUMROAD_PLAN_ID_MONTHLY?: string
  GUMROAD_PLAN_ID_YEARLY?: string
  GUMROAD_WEBHOOK_SECRET?: string

  REDIRECT_URI_ALLOWLIST?: string
  REDIRECT_ALLOWLIST?: string // seen in the code

  // For local dev
  SECRET?: string

  // Auth URLs (optional overrides)
  AUTH_GOOGLE_AUTH_URL?: string
  AUTH_GOOGLE_TOKEN_URL?: string
  AUTH_GOOGLE_USERINFO_URL?: string
  AUTH_MICROSOFT_AUTH_URL?: string
  AUTH_MICROSOFT_TOKEN_URL?: string
  AUTH_MICROSOFT_USERINFO_URL?: string
}

/** 默认的文本补全模型，兼顾体积与生成质量。 */
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'
/** 默认的文本嵌入模型，用于生成语义向量。 */
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-m3'
/** 默认的采样温度，控制生成结果的随机度。 */
const DEFAULT_TEMPERATURE = 0.6
/** 默认 JWT 过期时间（秒）。 */
const DEFAULT_JWT_EXPIRES_IN = 7 * 24 * 60 * 60 // 7 days in seconds
/** 默认最大返回 Token 数量，防止生成过长响应。 */
const DEFAULT_MAX_TOKENS = 256
/** 爬取网页的超时时间（毫秒）。 */
const CRAWL_TIMEOUT_MS = 8000
/** HTML 截断长度上限，避免解析过大的页面。 */
const HTML_SLICE_LIMIT = 16384
/** 不支持的媒体类型状态码。 */
const STATUS_UNSUPPORTED_MEDIA_TYPE = 415
/** 爬取请求使用的标准浏览器 UA。 */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
/**
 * 接受的 HTML 内容类型列表，偏向常见网页格式。
 */
const ACCEPT_HTML =
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
/** 最小嵌入文本长度，短文本直接返回 400。 */
const MIN_EMBED_TEXT_LENGTH = 3
/** 默认允许的重定向域后缀，用于 Chrome 扩展 WebAuthFlow。 */
const DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES = ['.chromiumapp.org']

/**
 * 统一 CORS 响应头配置，允许跨域访问 REST 接口。
 */
const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
}

/**
 * 返回成功的 JSON 响应
 *
 * @param data - 要返回的数据
 * @returns {Response} JSON 响应对象
 */
const okJson = (data: unknown): Response =>
  new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })

/**
 * 返回错误的 JSON 响应
 *
 * @param data - 错误数据
 * @param {number} status - HTTP 状态码，默认 500
 * @returns {Response} 错误响应对象
 */
const errorJson = (data: unknown, status = 500): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })

/**
 * 处理 OPTIONS 预检请求
 *
 * @returns {Response} CORS 响应
 */
function handleOptions(): Response {
  return new Response(null, { headers: corsHeaders })
}

/**
 * 处理健康检查请求
 *
 * @returns {Response} 健康状态响应
 */
function handleHealth(): Response {
  return okJson({
    status: 'ok',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString()
  })
}

// ===================== 加密、编码和认证辅助函数 =====================

/**
 * 处理 AI 文本补全请求
 *
 * 支持：
 * - 单次问答（prompt）
 * - 多轮对话（messages）
 * - 流式输出
 * - 自定义模型参数
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} AI 生成的响应
 */
async function handleAIComplete(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url)
    const body =
      request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const prompt = url.searchParams.get('prompt') || body.prompt || ''
    const messages = body.messages || undefined
    const stream =
      body.stream === true || url.searchParams.get('stream') === 'true'
    const model = body.model || url.searchParams.get('model') || DEFAULT_MODEL
    const temperature = body.temperature ?? DEFAULT_TEMPERATURE
    const max_tokens = body.max_tokens ?? DEFAULT_MAX_TOKENS

    if (!prompt && !Array.isArray(messages))
      return errorJson({ error: 'missing prompt or messages' }, 400)

    const params =
      Array.isArray(messages) && messages.length > 0
        ? { messages, stream, temperature, max_tokens }
        : { prompt, stream, temperature, max_tokens }

    const answer = await env.AI.run(model, params)
    if (stream)
      return new Response(answer, {
        headers: { 'content-type': 'text/event-stream', ...corsHeaders }
      })
    return okJson(answer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理 AI 文本嵌入（向量化）请求
 *
 * 将文本转换为向量表示，用于语义搜索和相似度计算
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 包含向量的响应
 */
async function handleAIEmbedding(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url)
    const body =
      request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const text = url.searchParams.get('text') || body.text || ''
    const model =
      body.model || url.searchParams.get('model') || DEFAULT_EMBEDDING_MODEL
    if (!text) return errorJson({ error: 'missing text' }, 400)
    const trimmed = text.trim()
    if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
      return errorJson(
        {
          error: 'text too short',
          details: {
            minTextLength: MIN_EMBED_TEXT_LENGTH,
            actualLength: trimmed.length
          }
        },
        400
      )
    }

    const vector = await generateEmbeddingVector(env, model, trimmed)

    if (!Array.isArray(vector) || vector.length === 0) {
      return errorJson(
        {
          error: 'embedding generation produced empty vector',
          details: { model, textLength: trimmed.length }
        },
        500
      )
    }
    return okJson({ vector, model })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

// === Vectorize 集成：向量 upsert / 查询 ===

/**
 * 处理向量数据库的插入/更新操作
 *
 * 将向量数据批量上传到 Cloudflare Vectorize
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 操作结果响应
 */
async function handleVectorizeUpsert(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    if (request.method !== 'POST')
      return errorJson({ error: 'Method not allowed' }, 405)
    const body = await request.json().catch(() => ({}))
    const vectors = Array.isArray(body?.vectors) ? body.vectors : []
    if (!vectors.length) return errorJson({ error: 'missing vectors' }, 400)

    // 规范化输入
    const normalized = vectors
      .map(v => ({
        id: String(v.id),
        values: Array.isArray(v.values)
          ? v.values
          : Array.isArray(v.vector)
            ? v.vector
            : [],
        metadata: v.metadata || {}
      }))
      .filter(v => Array.isArray(v.values) && v.values.length > 0 && v.id)

    if (!normalized.length) return errorJson({ error: 'no valid vectors' }, 400)

    const result = await env.VECTORIZE.upsert(normalized)
    const attempted = normalized.length
    // Cloudflare API 可能仅返回 mutationId；将尝试数作为参考返回
    return okJson({
      success: true,
      attempted,
      mutation: result?.mutation || result
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理向量查询请求
 *
 * 在向量数据库中进行相似度搜索
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 查询结果响应
 */
async function handleVectorizeQuery(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url)
    const body =
      request.method === 'POST' ? await request.json().catch(() => ({})) : {}
    const text = url.searchParams.get('text') || body.text || ''
    const vector = Array.isArray(body.vector) ? body.vector : undefined
    const topK = Number(url.searchParams.get('topK') || body.topK || 10)
    const returnMetadata =
      body.returnMetadata || url.searchParams.get('returnMetadata') || 'indexed'
    const returnValues =
      body.returnValues === true ||
      url.searchParams.get('returnValues') === 'true'
    const modelOverride =
      body.model || url.searchParams.get('model') || undefined

    let queryVector = vector
    if (!queryVector) {
      if (!text) return errorJson({ error: 'missing text or vector' }, 400)
      const trimmed = text.trim()
      if (trimmed.length < MIN_EMBED_TEXT_LENGTH) {
        return errorJson(
          {
            error: 'text too short for embedding',
            details: {
              minTextLength: MIN_EMBED_TEXT_LENGTH,
              actualLength: trimmed.length
            }
          },
          400
        )
      }
      const model = modelOverride || DEFAULT_EMBEDDING_MODEL
      try {
        queryVector = await generateEmbeddingVector(env, model, trimmed)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return errorJson(
          {
            error: `embedding generation failed: ${msg}`,
            details: { model, textLength: trimmed.length }
          },
          500
        )
      }
    }

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return errorJson(
        {
          error: 'embedding generation produced empty vector',
          details: { textLength: (text || '').trim().length }
        },
        500
      )
    }

    let matches
    try {
      matches = await env.VECTORIZE.query(queryVector, {
        topK,
        returnMetadata,
        returnValues
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return errorJson(
        {
          error: `vectorize query failed: ${msg}`,
          details: { topK, returnMetadata, returnValues }
        },
        500
      )
    }

    return okJson({ success: true, matches })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理网页爬取请求
 *
 * 功能：
 * - 获取目标 URL 的 HTML 内容
 * - 提取页面元数据（标题、描述、关键词）
 * - 提取 Open Graph 信息
 * - 支持超时控制和重定向
 *
 * @param {Request} request - HTTP 请求对象
 * @returns {Promise<Response>} 包含页面元数据的响应
 */
async function handleCrawl(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    let targetUrl = url.searchParams.get('url') || ''
    if (!targetUrl && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      targetUrl = body.url || ''
    }
    if (!targetUrl) return errorJson({ error: 'missing url' }, 400)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS)
    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: ACCEPT_HTML },
      redirect: 'follow'
    })
    clearTimeout(timeoutId)

    if (!resp.ok)
      return errorJson({ error: `HTTP ${resp.status}` }, resp.status)
    const contentType = resp.headers.get('content-type') || ''
    if (!contentType.includes('text/html'))
      return errorJson(
        { error: `Not HTML: ${contentType}` },
        STATUS_UNSUPPORTED_MEDIA_TYPE
      )

    const html = await resp.text()
    const limited = html.slice(0, HTML_SLICE_LIMIT)
    const titleMatch = limited.match(/<title[^>]*>([^<]*)<\/title>/i)
    const getMeta = (attr, value) => {
      const re = new RegExp(
        `<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"]*)["'][^>]*>`,
        'i'
      )
      const m = limited.match(re)
      return m?.[1]?.trim() || ''
    }

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
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * Cloudflare Worker 入口函数，根据路径分发至具体业务处理器。
 *
 * @param {Request} request - 触发 Worker 的原始请求
 * @param {Record<string, any>} env - 绑定在 Worker 上下文的环境变量合集
 * @returns {Promise<Response>} 处理完成后的响应对象
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './router'
import { createContext } from './trpc'

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url)

    // Handle tRPC requests
    if (url.pathname.startsWith('/trpc')) {
      return fetchRequestHandler({
        endpoint: '/trpc',
        req: request,
        router: appRouter,
        createContext: () =>
          createContext({ req: request, resHeaders: new Headers() }),
        onError:
          process.env.NODE_ENV === 'development'
            ? ({ path, error }) => {
                console.error(
                  `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
                )
              }
            : undefined
      })
    }

    if (request.method === 'OPTIONS') return handleOptions()

    const ROUTES = {
      '/api/health': () => handleHealth(),
      '/health': () => handleHealth(),
      // Admin
      '/api/admin/env/check': () => handleAdminEnvCheck(request, env),
      // Auth & Account
      '/api/auth/start': () => handleAuthStart(request, env),
      '/api/auth/callback': () => handleAuthCallback(request, env),
      '/api/auth/providers': () => handleAuthProviders(request, env),
      // AI & Vectorize
      '/api/ai/complete': () => handleAIComplete(request, env),
      '/api/ai/embedding': () => handleAIEmbedding(request, env),
      '/api/vectorize/upsert': () => handleVectorizeUpsert(request, env),
      '/api/vectorize/query': () => handleVectorizeQuery(request, env),
      // Gumroad
      '/api/gumroad/subscription': async () => {
        const { handleGetSubscription } = await import('./gumroad-handler.ts')
        return handleGetSubscription(request, env)
      },
      '/api/gumroad/webhook': async () => {
        const { handleWebhook } = await import('./gumroad-handler.ts')
        return handleWebhook(request, env)
      },
      // Crawl
      '/api/crawl': () => handleCrawl(request)
    }
    const handler = ROUTES[url.pathname]
    if (handler) {
      const result = await handler()
      return result
    }
    return new Response('Not Found', { status: 404, headers: corsHeaders })
  }
}

// ===================== Admin (Dev-only) =====================
/**
 * 收集环境变量中已配置的键值，便于构建诊断报告。
 *
 * @param {Record<string, unknown>} env - Cloudflare Worker 绑定的环境变量
 * @param {string[]} keys - 需要检查的键名列表
 * @returns {Record<string, string>} 仅包含已配置键的结果对象
 */
function pickExisting(env, keys) {
  const out = {}
  for (const k of keys) {
    if (env && env[k] !== undefined)
      out[k] =
        typeof env[k] === 'string' && env[k].length > 0 ? '(set)' : '(empty)'
  }
  return out
}

/**
 * 获取缺失的环境变量列表。
 *
 * @param {Record<string, unknown>} env - 当前运行环境变量
 * @param {string[]} keys - 期望存在的键名列表
 * @returns {string[]} 未配置的键名集合
 */
function listMissing(env, keys) {
  return keys.filter(k => !env || !env[k])
}

/**
 * 构建认证相关配置的概览报告。
 *
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @returns {object} 包含缺失项、已配置项与可选项的汇总数据
 */
function buildEnvReport(env) {
  const must = {
    jwt: ['JWT_SECRET'],
    google: ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'],
    microsoft: ['AUTH_MICROSOFT_CLIENT_ID', 'AUTH_MICROSOFT_CLIENT_SECRET']
  }
  const missing = {
    jwt: listMissing(env, must.jwt),
    google: listMissing(env, must.google),
    microsoft: listMissing(env, must.microsoft)
  }
  const has = {
    jwt: pickExisting(env, must.jwt),
    google: pickExisting(env, must.google),
    microsoft: pickExisting(env, must.microsoft)
  }
  const optional = {
    allowlist: env.REDIRECT_URI_ALLOWLIST || env.REDIRECT_ALLOWLIST || undefined
  }
  return { has, missing, optional }
}

/**
 * Admin 接口：输出环境变量配置状态，辅助开发调试。
 *
 * @param {Request} _request - 原始请求对象（未使用）
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @returns {Response} 标准 JSON 响应
 */
function handleAdminEnvCheck(_request, env) {
  try {
    const report = buildEnvReport(env)
    // 额外提供 providers 计算结果，便于对齐 /api/auth/providers
    const gCfg = getProviderConfig('google', env)
    const msCfg = getProviderConfig('microsoft', env)
    const providers = {
      google: Boolean(gCfg),
      googleHasSecret: Boolean(gCfg && gCfg.clientSecret),
      microsoft: Boolean(msCfg),
      microsoftHasSecret: Boolean(msCfg && msCfg.clientSecret)
    }
    return okJson({ success: true, report, providers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}
// === 安全与校验工具 ===
/**
 * 解析重定向允许列表，可兼容 JSON 数组或逗号分隔字符串。
 */
function parseAllowlist(env) {
  const raw =
    env && (env.REDIRECT_URI_ALLOWLIST || env.REDIRECT_ALLOWLIST || '')
  if (!raw) return []
  try {
    if (raw.trim().startsWith('[')) {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.map(String) : []
    }
  } catch (e) {
    console.error('parseAllowlist failed', e)
  }
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * 判断是否为本地 HTTPS（localhost/127.0.0.1）。
 */
function isHttpsLikeLocal(u) {
  return (
    u.protocol === 'https:' &&
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  )
}

/**
 * 校验 redirect_uri 是否符合协议与域名要求。
 */
function isAllowedRedirectUri(redirectUri, env) {
  try {
    const u = new URL(redirectUri)
    // 协议限制：允许 https、chrome-extension。对本地 https 放行 localhost/127.0.0.1
    const scheme = u.protocol
    if (
      scheme !== 'https:' &&
      scheme !== 'chrome-extension:' &&
      !isHttpsLikeLocal(u)
    ) {
      return { ok: false, error: 'unsupported scheme' }
    }
    if (scheme === 'https:') {
      // 允许 chromiumapp.org（Chrome WebAuthFlow 回调域）
      const host = u.hostname.toLowerCase()
      if (
        !DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES.some(suf => host.endsWith(suf))
      ) {
        // 非 chromiumapp.org 则需要进入 allowlist 检查
        const allow = parseAllowlist(env)
        if (allow.length) {
          const href = u.toString()
          const origin = `${u.protocol}//${u.host}`
          const ok = allow.some(
            item => href.startsWith(item) || origin === item || host === item
          )
          if (!ok) return { ok: false, error: 'redirect not in allowlist' }
        }
      }
    }
    // 额外拒绝明显危险的 scheme
    if (scheme === 'javascript:' || scheme === 'data:')
      return { ok: false, error: 'dangerous scheme' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'invalid redirect_uri' }
  }
}
// === Embedding 解析助手：统一从多种返回结构提取向量 ===
function extractEmbeddingVector(answer) {
  if (!answer) return undefined
  // 直接数组
  if (Array.isArray(answer)) return answer
  // Cloudflare 文档：{ data: [vector] }
  if (Array.isArray(answer.data)) {
    const first = answer.data[0]
    if (Array.isArray(first)) return first
    if (first && Array.isArray(first.embedding)) return first.embedding // OpenAI兼容
    // 某些返回可能直接是 data: vector
    if (typeof answer.data[0] === 'number') return answer.data
  }
  // 其他字段：embeddings 或 embedding
  if (Array.isArray(answer.embeddings)) {
    const e0 = answer.embeddings[0]
    return Array.isArray(e0) ? e0 : answer.embeddings
  }
  if (Array.isArray(answer.embedding)) return answer.embedding
  return undefined
}

/**
 * 请求 Cloudflare AI 服务生成文本向量。
 */
async function generateEmbeddingVector(env, model, text) {
  const emb = await env.AI.run(model, { text })
  return extractEmbeddingVector(emb)
}

// ===================== Minimal Auth & JWT =====================
/**
 * 将字节或字符串编码为 base64url。
 */
function base64urlEncode(data) {
  const bytes =
    typeof data === 'string'
      ? new globalThis.TextEncoder().encode(data)
      : new Uint8Array(data)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = globalThis.btoa(bin)
  return b64.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * 将对象转为 JSON 后再进行 base64url 编码。
 */
function base64urlFromJSON(obj) {
  const json = JSON.stringify(obj)
  return base64urlEncode(new globalThis.TextEncoder().encode(json))
}

async function hmacSign(keyBytes, data) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    new globalThis.TextEncoder().encode(data)
  )
  return new Uint8Array(sig)
}

async function signJWT(secret, payload, expiresInSec = DEFAULT_JWT_EXPIRES_IN) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = {
    iat: now,
    exp: now + Number(expiresInSec || DEFAULT_JWT_EXPIRES_IN),
    ...payload
  }
  const unsigned = `${base64urlFromJSON(header)}.${base64urlFromJSON(body)}`
  const sigBytes = await hmacSign(
    new globalThis.TextEncoder().encode(secret),
    unsigned
  )
  const signature = base64urlEncode(sigBytes)
  return `${unsigned}.${signature}`
}

// 列出各 OAuth Provider 是否已配置，便于前端动态展示
/**
 * 列出各 OAuth Provider 配置状态，供前端动态渲染。
 *
 * @param {Request} _request - 原始请求对象（未使用）
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @returns {Response} JSON 响应，包含 provider 启用情况
 */
function handleAuthProviders(_request, env) {
  try {
    const gCfg = getProviderConfig('google', env)
    const google = Boolean(gCfg)
    const googleHasSecret = Boolean(gCfg && gCfg.clientSecret)
    const msCfg = getProviderConfig('microsoft', env)
    const microsoft = Boolean(msCfg)
    const microsoftHasSecret = Boolean(msCfg && msCfg.clientSecret)
    const allow = parseAllowlist(env)
    return okJson({
      success: true,
      providers: {
        google,
        googleHasSecret,
        microsoft,
        microsoftHasSecret
      },
      redirectAllowlist: allow.length ? allow : undefined,
      note: '默认放行 https://*.chromiumapp.org 作为 Chrome 扩展回调域'
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

// === OAuth skeleton ===
/**
 * OAuth 授权起点，返回跳转 URL。
 *
 * @param {Request} request - 原始请求
 * @param {Record<string, unknown>} _env - Cloudflare 环境变量
 * @returns {Response} JSON 响应，包含授权信息
 */
function handleAuthStart(request, _env) {
  try {
    const url = new URL(request.url)
    const provider = (
      url.searchParams.get('provider') || 'google'
    ).toLowerCase()
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const codeChallenge = url.searchParams.get('code_challenge') || ''
    const scope = url.searchParams.get('scope') || ''
    if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400)
    const redirCheck = isAllowedRedirectUri(redirectUri, _env)
    if (!redirCheck.ok)
      return errorJson(
        { error: `invalid redirect_uri: ${redirCheck.error}` },
        400
      )
    // 支持 google、microsoft
    if (!['google', 'microsoft'].includes(provider)) {
      return errorJson({ error: `unsupported provider: ${provider}` }, 400)
    }
    const cfg = getProviderConfig(provider, _env)
    if (!cfg) {
      const missing =
        provider === 'google'
          ? ['AUTH_GOOGLE_CLIENT_ID'].filter(k => !_env?.[k])
          : provider === 'microsoft'
            ? ['AUTH_MICROSOFT_CLIENT_ID'].filter(k => !_env?.[k])
            : []
      return errorJson(
        { error: `provider not configured: ${provider}`, missing },
        400
      )
    }
    const state =
      url.searchParams.get('state') || Math.random().toString(36).slice(2)
    const authUrl = new URL(cfg.authUrl)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', cfg.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    if (codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
    }
    authUrl.searchParams.set('scope', scope || cfg.scope || '')
    authUrl.searchParams.set('state', state)
    if (provider === 'google') {
      authUrl.searchParams.set('prompt', 'consent')
      authUrl.searchParams.set('access_type', 'offline')
    }
    return okJson({
      success: true,
      provider,
      authUrl: authUrl.toString(),
      state
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

async function handleAuthCallback(request, env) {
  try {
    const url = new URL(request.url)
    const provider = (
      url.searchParams.get('provider') || 'google'
    ).toLowerCase()
    const code = url.searchParams.get('code') || ''
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const codeVerifier = url.searchParams.get('code_verifier') || ''
    if (!code) return errorJson({ error: 'missing code' }, 400)

    // 支持 google、microsoft
    if (!['google', 'microsoft'].includes(provider)) {
      return errorJson({ error: `unsupported provider: ${provider}` }, 400)
    }

    // OAuth 2.0 授权码交换
    const cfg = getProviderConfig(provider, env)
    if (!cfg) {
      const missing =
        provider === 'google'
          ? ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'].filter(
              k => !env?.[k]
            )
          : provider === 'microsoft'
            ? [
                'AUTH_MICROSOFT_CLIENT_ID',
                'AUTH_MICROSOFT_CLIENT_SECRET'
              ].filter(k => !env?.[k])
            : []
      return errorJson(
        { error: `provider not configured: ${provider}`, missing },
        400
      )
    }
    if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400)
    const redirCheck = isAllowedRedirectUri(redirectUri, env)
    if (!redirCheck.ok)
      return errorJson(
        { error: `invalid redirect_uri: ${redirCheck.error}` },
        400
      )
    if (!codeVerifier) return errorJson({ error: 'missing code_verifier' }, 400)
    const accessToken = await exchangeCodeForToken(
      cfg,
      code,
      redirectUri,
      codeVerifier
    )
    const { email, sub } = await fetchUserInfoWithAccessToken(
      provider,
      cfg,
      accessToken
    )
    const userId = `${provider}:${sub || email || Math.random().toString(36).slice(2)}`
    const tier = 'free'
    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
    const token = await signJWT(
      secret,
      { sub: userId, email, tier, features: {} },
      7 * 24 * 60 * 60
    )
    const now = Math.floor(Date.now() / 1000)
    return okJson({
      success: true,
      token,
      tier,
      user: { id: userId, email },
      expiresAt: now + 7 * 24 * 60 * 60
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

function getProviderConfig(provider, env) {
  if (provider === 'google') {
    const clientId = env.AUTH_GOOGLE_CLIENT_ID
    const clientSecret = env.AUTH_GOOGLE_CLIENT_SECRET
    const authUrl =
      env.AUTH_GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth'
    const tokenUrl =
      env.AUTH_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token'
    const userInfoUrl =
      env.AUTH_GOOGLE_USERINFO_URL ||
      'https://openidconnect.googleapis.com/v1/userinfo'
    if (!clientId) return null
    return {
      provider,
      clientId,
      clientSecret,
      authUrl,
      tokenUrl,
      userInfoUrl,
      scope: 'openid email profile'
    }
  }
  if (provider === 'microsoft') {
    const clientId = env.AUTH_MICROSOFT_CLIENT_ID
    const clientSecret = env.AUTH_MICROSOFT_CLIENT_SECRET
    const authUrl =
      env.AUTH_MICROSOFT_AUTH_URL ||
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    const tokenUrl =
      env.AUTH_MICROSOFT_TOKEN_URL ||
      'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    const userInfoUrl =
      env.AUTH_MICROSOFT_USERINFO_URL || 'https://graph.microsoft.com/v1.0/me'
    if (!clientId) return null
    return {
      provider,
      clientId,
      clientSecret,
      authUrl,
      tokenUrl,
      userInfoUrl,
      scope: 'openid email profile'
    }
  }
  return null
}

/**
 * OAuth 授权码交换 Access Token。
 *
 * @param {object} cfg - Provider 配置
 * @param {string} code - 授权码
 * @param {string} redirectUri - 回调地址
 * @param {string} codeVerifier - PKCE Code Verifier
 * @returns {Promise<string>} 下游返回的 access_token
 */
async function exchangeCodeForToken(cfg, code, redirectUri, codeVerifier) {
  const form = new globalThis.URLSearchParams()
  form.set('grant_type', 'authorization_code')
  form.set('code', code)
  form.set('redirect_uri', redirectUri)
  form.set('client_id', cfg.clientId)
  form.set('code_verifier', codeVerifier)
  if (cfg.clientSecret) form.set('client_secret', cfg.clientSecret)
  const tokenResp = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: form.toString()
  })
  if (!tokenResp.ok) {
    let detail = ''
    try {
      detail = await tokenResp.text()
    } catch {
      /* ignore */
    }
    throw new Error(
      `token exchange failed ${tokenResp.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    )
  }
  const tokenJson = await tokenResp.json().catch(() => ({}))
  const accessToken = tokenJson.access_token
  if (!accessToken) throw new Error('missing access_token')
  return accessToken
}

/**
 * 使用 Access Token 获取用户信息，抹平不同 Provider 的字段差异。
 *
 * @param {string} provider - Provider 名称（google/github）
 * @param {object} cfg - Provider 配置
 * @param {string} accessToken - OAuth Access Token
 * @returns {Promise<{ email: string; sub: string }>} 标准化后的用户信息
 */
async function fetchUserInfoWithAccessToken(provider, cfg, accessToken) {
  if (provider === 'google') {
    const uResp = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const u = await uResp.json().catch(() => ({}))
    return { email: String(u.email || ''), sub: String(u.sub || '') }
  }
  if (provider === 'github') {
    const uResp = await fetch(cfg.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'user-agent': 'AcuityBookmarks'
      }
    })
    const u = await uResp.json().catch(() => ({}))
    let email = String(u.email || '')
    const sub = String(u.id || '')
    if (!email) {
      try {
        const eResp = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
            'user-agent': 'AcuityBookmarks'
          }
        })
        const arr = await eResp.json().catch(() => [])
        if (Array.isArray(arr) && arr.length) {
          const primary = arr.find(x => x && x.primary) || arr[0]
          if (primary && primary.email) email = String(primary.email)
        }
      } catch (e) {
        console.error('fetchUserInfoWithAccessToken failed', e)
      }
    }
    return { email, sub }
  }
  return { email: '', sub: '' }
}

// ===================== Payments Integration =====================
// Gumroad 相关处理器会在支付路由被访问时按需加载
