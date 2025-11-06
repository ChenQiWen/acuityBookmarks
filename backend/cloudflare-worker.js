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
/** 密码最小长度，确保基础复杂度。 */
const PWD_MIN_LEN = 10
/** PBKDF2 迭代次数，数值越高安全性越好。
 * 注意：Cloudflare Workers Web Crypto API 限制最大 100000 次迭代
 */
const PWD_ITER = 100000 // PBKDF2 iterations (Cloudflare Workers 限制)
/** 密码派生算法名称。 */
const PWD_ALGO = 'pbkdf2-sha256'
/** 访问令牌默认有效期（秒）。 */
const ACCESS_TTL = 60 * 60 // 1h
/** 刷新令牌默认有效期（秒）。 */
const REFRESH_TTL = 30 * 24 * 60 * 60 // 30d
/** 密码重置令牌有效期（秒）。 */
const RESET_TTL = 20 * 60 // 20m
/** PBKDF2 输出字节长度。 */
const DERIVED_KEY_LEN = 32
/** 随机盐值长度。 */
const SALT_LEN = 16
/** 邮箱字段允许的最小长度。 */
const EMAIL_MIN_LEN = 6
/** 账户锁定窗口时间（毫秒）。 */
const LOCK_WINDOW_MS = 10 * 60 * 1000 // 10m
/** 失败次数达到阈值时锁定账户。 */
const LOCK_FAIL_MAX = 5
/** 32 字节随机数，用于刷新令牌等。 */
const RAND_BYTES_32 = 32
/** 16 字节随机数，用于 JWT jti 等。 */
const RAND_BYTES_16 = 16
/** HTTP 冲突状态码常量。 */
const HTTP_CONFLICT = 409
/** HTTP 资源锁定状态码常量。 */
const HTTP_LOCKED = 423
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
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
}

/**
 * 返回成功的 JSON 响应
 *
 * @param {*} data - 要返回的数据
 * @returns {Response} JSON 响应对象
 */
const okJson = data =>
  new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })

/**
 * 返回错误的 JSON 响应
 *
 * @param {*} data - 错误数据
 * @param {number} status - HTTP 状态码，默认 500
 * @returns {Response} 错误响应对象
 */
const errorJson = (data, status = 500) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })

/**
 * 处理 OPTIONS 预检请求
 *
 * @returns {Response} CORS 响应
 */
function handleOptions() {
  return new Response(null, { headers: corsHeaders })
}

/**
 * 处理健康检查请求
 *
 * @returns {Response} 健康状态响应
 */
function handleHealth() {
  return okJson({
    status: 'ok',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString()
  })
}

// ===================== 加密、编码和认证辅助函数 =====================

/**
 * 将字节数组转换为 Base64URL 编码字符串
 *
 * @param {Uint8Array} bytes - 字节数组
 * @returns {string} Base64URL 编码的字符串
 */
function toBase64Url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = globalThis.btoa(bin)
  return b64.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * 将 UTF-8 文本转换为字节数组
 *
 * @param {string} text - UTF-8 文本
 * @returns {Uint8Array} 字节数组
 */
function fromUtf8(text) {
  return new globalThis.TextEncoder().encode(text)
}

/**
 * 生成随机 Base64URL 编码字符串
 *
 * @param {number} n - 字节长度，默认 32
 * @returns {string} 随机 Base64URL 字符串
 */
function randomBase64Url(n = RAND_BYTES_32) {
  const arr = new Uint8Array(n)
  globalThis.crypto.getRandomValues(arr)
  return toBase64Url(arr)
}

/**
 * 使用 PBKDF2-SHA256 派生密钥
 *
 * @param {string} password - 密码
 * @param {Uint8Array} saltBytes - 盐值字节数组
 * @param {number} iterations - 迭代次数，默认 PWD_ITER (100000，Cloudflare Workers 限制)
 * @param {number} length - 输出长度（字节），默认 32
 * @returns {Promise<Uint8Array>} 派生的密钥
 */
async function pbkdf2Sha256(
  password,
  saltBytes,
  iterations = PWD_ITER,
  length = 32
) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    fromUtf8(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    key,
    length * 8
  )
  return new Uint8Array(bits)
}

/**
 * 哈希密码（验证时使用）
 *
 * @param {string} password - 明文密码
 * @param {string} saltB64url - Base64URL 编码的盐值
 * @param {number} iterations - 迭代次数
 * @returns {Promise<string>} Base64URL 编码的哈希值
 */
async function hashPassword(password, saltB64url, iterations = PWD_ITER) {
  const salt = Uint8Array.from(
    globalThis.atob(saltB64url.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  )
  const derived = await pbkdf2Sha256(
    password,
    salt,
    iterations,
    DERIVED_KEY_LEN
  )
  return toBase64Url(derived)
}

/**
 * 为新密码生成哈希和盐值
 *
 * @param {string} password - 明文密码
 * @param {number} iterations - 迭代次数
 * @returns {Promise<object>} 包含 hash、salt、algo 和 iter 的对象
 */
async function deriveNewPassword(password, iterations = PWD_ITER) {
  const salt = new Uint8Array(SALT_LEN)
  globalThis.crypto.getRandomValues(salt)
  const hash = await pbkdf2Sha256(password, salt, iterations, DERIVED_KEY_LEN)
  return {
    hash: toBase64Url(hash),
    salt: toBase64Url(salt),
    algo: PWD_ALGO,
    iter: iterations
  }
}

/**
 * 计算 SHA-256 哈希并返回 Base64URL 编码
 *
 * @param {string|Uint8Array} input - 输入数据
 * @returns {Promise<string>} Base64URL 编码的哈希值
 */
async function sha256Base64Url(input) {
  const bytes = typeof input === 'string' ? fromUtf8(input) : input
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return toBase64Url(new Uint8Array(digest))
}

/**
 * 验证邮箱格式
 *
 * @param {string} email - 邮箱地址
 * @returns {boolean} 验证是否通过
 */
function validateEmail(email) {
  const e = String(email || '').trim()
  return e.length >= EMAIL_MIN_LEN && e.includes('@')
}

/**
 * 验证密码强度
 *
 * 要求：
 * - 至少 10 个字符
 * - 至少包含以下 3 种字符类型：小写字母、大写字母、数字、符号
 *
 * @param {string} pw - 密码
 * @returns {boolean} 密码强度是否合格
 */
function validatePasswordStrength(pw) {
  const s = String(pw || '')
  if (s.length < PWD_MIN_LEN) return false
  const hasLower = /[a-z]/.test(s)
  const hasUpper = /[A-Z]/.test(s)
  const hasDigit = /\d/.test(s)
  const hasSym = /[^A-Za-z0-9]/.test(s)
  let score = 0
  if (hasLower) score++
  if (hasUpper) score++
  if (hasDigit) score++
  if (hasSym) score++
  return score >= 3
}

/**
 * 获取密码强度详细信息
 *
 * 提供更详细的密码强度校验结果，便于前端提示用户
 *
 * @param {string} pw - 密码
 * @returns {object} 密码强度详情，包括各类字符是否包含、通过的类别数等
 */
function passwordStrengthDetails(pw) {
  const s = String(pw || '')
  const hasLower = /[a-z]/.test(s)
  const hasUpper = /[A-Z]/.test(s)
  const hasDigit = /\d/.test(s)
  const hasSym = /[^A-Za-z0-9]/.test(s)
  const passedClasses = [hasLower, hasUpper, hasDigit, hasSym].filter(
    Boolean
  ).length
  const details = {
    minLength: PWD_MIN_LEN,
    requireClasses: 3,
    passedClasses,
    classes: {
      lower: hasLower,
      upper: hasUpper,
      digit: hasDigit,
      symbol: hasSym
    },
    lengthOk: s.length >= PWD_MIN_LEN
  }
  return { ok: s.length >= PWD_MIN_LEN && passedClasses >= 3, ...details }
}

/**
 * 获取请求的客户端IP地址
 *
 * 优先使用 Cloudflare 提供的真实IP
 *
 * @param {Request} request - HTTP 请求对象
 * @returns {string} IP地址
 */
function getIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    ''
  )
}

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
async function handleAIComplete(request, env) {
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
async function handleAIEmbedding(request, env) {
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
async function handleVectorizeUpsert(request, env) {
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
async function handleVectorizeQuery(request, env) {
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
async function handleCrawl(request) {
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

// 已移除：服务端随机计算测试相关逻辑

/**
 * Cloudflare Worker 入口函数，根据路径分发至具体业务处理器。
 *
 * @param {Request} request - 触发 Worker 的原始请求
 * @param {Record<string, any>} env - 绑定在 Worker 上下文的环境变量合集
 * @returns {Promise<Response>} 处理完成后的响应对象
 */
/**
 * Cloudflare Worker 入口函数，根据路径分发至具体业务处理器。
 *
 * @param {Request} request - 触发 Worker 的原始请求
 * @param {Record<string, any>} env - 绑定在 Worker 上下文的环境变量合集
 * @returns {Promise<Response>} 处理完成后的响应对象
 */
export default {
  fetch(request, env) {
    if (request.method === 'OPTIONS') return handleOptions()
    const url = new URL(request.url)
    // Lazy ensure schema if D1 is bound — but skip for admin endpoints to avoid race with /api/admin/db/init
    const isAdminPath = url.pathname.startsWith('/api/admin/')
    if (!isAdminPath) {
      try {
        import('./utils/d1.js')
          .then(m => m.ensureSchema?.(env))
          .catch(() => {
            /* noop */
          })
      } catch (e) {
        console.error('ensureSchema failed', e)
      }
    }
    // Route map to keep complexity low
    const ROUTES = {
      '/api/health': () => handleHealth(),
      '/health': () => handleHealth(),
      // Admin
      '/api/admin/db/init': () => handleAdminDbInit(request, env),
      '/api/admin/db/stats': () => handleAdminDbStats(request, env),
      '/api/admin/env/check': () => handleAdminEnvCheck(request, env),
      // Auth & Account
      '/api/auth/register': () => handleRegister(request, env),
      '/api/auth/login': () => handlePasswordLogin(request, env),
      '/api/auth/refresh': () => handleRefresh(request, env),
      '/api/auth/forgot-password': () => handleForgotPassword(request, env),
      '/api/auth/reset-password': () => handleResetPassword(request, env),
      '/api/auth/change-password': () => handleChangePassword(request, env),
      '/api/auth/start': () => handleAuthStart(request, env),
      '/api/auth/callback': () => handleAuthCallback(request, env),
      '/api/auth/providers': () => handleAuthProviders(request, env),
      '/auth/dev/authorize': () => handleAuthDevAuthorize(request, env),
      '/api/user/me': () => handleUserMe(request, env),
      '/api/user/nickname': () => handleUserNickname(request, env),
      '/api/auth/dev-login': () => handleDevLogin(request, env),
      // AI & Vectorize
      '/api/ai/complete': () => handleAIComplete(request, env),
      '/api/ai/embedding': () => handleAIEmbedding(request, env),
      '/api/vectorize/upsert': () => handleVectorizeUpsert(request, env),
      '/api/vectorize/query': () => handleVectorizeQuery(request, env),
      // Lemon Squeezy
      '/api/lemon-squeezy/checkout': async () => {
        const { handleCreateCheckout } = await import(
          './lemon-squeezy-handler.js'
        )
        return handleCreateCheckout(request, env)
      },
      '/api/lemon-squeezy/subscription': async () => {
        const { handleGetSubscription } = await import(
          './lemon-squeezy-handler.js'
        )
        return handleGetSubscription(request, env)
      },
      '/api/lemon-squeezy/subscription/cancel': async () => {
        const { handleCancelSubscription } = await import(
          './lemon-squeezy-handler.js'
        )
        return handleCancelSubscription(request, env)
      },
      '/api/lemon-squeezy/subscription/resume': async () => {
        const { handleResumeSubscription } = await import(
          './lemon-squeezy-handler.js'
        )
        return handleResumeSubscription(request, env)
      },
      '/api/lemon-squeezy/webhook': async () => {
        const { handleWebhook } = await import('./lemon-squeezy-handler.js')
        return handleWebhook(request, env)
      },
      // Crawl
      '/api/crawl': () => handleCrawl(request)
    }
    const handler = ROUTES[url.pathname]
    if (handler) return handler()
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
    github: ['AUTH_GITHUB_CLIENT_ID', 'AUTH_GITHUB_CLIENT_SECRET']
  }
  const missing = {
    jwt: listMissing(env, must.jwt),
    google: listMissing(env, must.google),
    github: listMissing(env, must.github)
  }
  const has = {
    jwt: pickExisting(env, must.jwt),
    google: pickExisting(env, must.google),
    github: pickExisting(env, must.github)
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
    const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
    if (!allowDev) return errorJson({ error: 'forbidden' }, 403)
    const report = buildEnvReport(env)
    // 额外提供 providers 计算结果，便于对齐 /api/auth/providers
    const gCfg = getProviderConfig('google', env)
    const ghCfg = getProviderConfig('github', env)
    const providers = {
      google: Boolean(gCfg),
      googleHasSecret: Boolean(gCfg && gCfg.clientSecret),
      github: Boolean(ghCfg),
      githubHasSecret: Boolean(ghCfg && ghCfg.clientSecret)
    }
    return okJson({ success: true, report, providers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}
/**
 * Admin 接口：初始化 D1 数据库结构。
 *
 * @param {Request} _request - 原始请求对象（未使用）
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @returns {Promise<Response>} JSON 响应，记录是否执行成功
 */
async function handleAdminDbInit(_request, env) {
  try {
    const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
    if (!allowDev) return errorJson({ error: 'forbidden' }, 403)
    const m = await import('./utils/d1.js')
    const has = m.hasD1(env)
    if (!has)
      return okJson({ success: true, ensured: false, db: 'not-configured' })
    const ok = await m.ensureSchema(env)
    return okJson({ success: true, ensured: Boolean(ok), db: 'configured' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * Admin 接口：统计 D1 表数据量，辅助健康检查。
 *
 * @param {Request} _request - 原始请求对象（未使用）
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @returns {Promise<Response>} JSON 响应，包含各表计数
 */
async function handleAdminDbStats(_request, env) {
  try {
    const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
    if (!allowDev) return errorJson({ error: 'forbidden' }, 403)
    const m = await import('./utils/d1.js')
    if (!m.hasD1(env)) return okJson({ success: true, db: 'not-configured' })
    const tableExists = async name => {
      const row = await env.DB.prepare(
        'SELECT 1 as ok FROM sqlite_master WHERE type="table" AND name=?'
      )
        .bind(name)
        .first()
      return Boolean(row)
    }
    const safeCount = async name => {
      try {
        if (!(await tableExists(name))) return { exists: false, count: 0 }
        const r = await env.DB.prepare(
          `SELECT COUNT(*) as cnt FROM ${name}`
        ).first()
        return { exists: true, count: Number(r?.cnt || 0) }
      } catch (e) {
        return {
          exists: false,
          count: 0,
          error: e instanceof Error ? e.message : String(e)
        }
      }
    }
    const users = await safeCount('users')
    const entitlements = await safeCount('entitlements')
    const refresh_tokens = await safeCount('refresh_tokens')
    const password_resets = await safeCount('password_resets')
    return okJson({
      success: true,
      tables: { users, entitlements, refresh_tokens, password_resets }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

// ===================== First-party auth handlers =====================
/**
 * 确保 D1 数据库可用，否则返回标识对象方便上层降级。
 *
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @returns {Promise<{ ok: boolean; mod: any }>} 包含可用标记与 D1 工具模块
 */
async function mustD1(env) {
  const m = await import('./utils/d1.js')
  if (!m.hasD1(env)) return { ok: false, mod: m }
  return { ok: true, mod: m }
}

/**
 * 使用环境密钥签发访问令牌。
 *
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @param {Record<string, unknown>} payload - JWT 载荷对象
 * @param {number} ttlSec - 令牌有效期（秒）
 * @returns {Promise<string>} 已签名的 JWT 字符串
 */
async function signAccess(env, payload, ttlSec = ACCESS_TTL) {
  const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
  return signJWT(secret, payload, ttlSec)
}

/**
 * 为指定用户生成刷新令牌并写入数据库。
 *
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @param {any} mod - D1 工具模块
 * @param {string} userId - 用户唯一标识
 * @returns {Promise<{ token: string; jti: string; expiresAt: number }>} 新刷新令牌信息
 */
async function newRefreshForUser(env, mod, userId) {
  const token = randomBase64Url(RAND_BYTES_32)
  const tokenHash = await sha256Base64Url(token)
  const jti = randomBase64Url(RAND_BYTES_16)
  const expiresAt = Math.floor(Date.now() / 1000) + REFRESH_TTL
  await mod.insertRefreshToken(env, { jti, userId, tokenHash, expiresAt })
  return { token, jti, expiresAt }
}

/**
 * 处理用户注册请求
 *
 * 流程：
 * 1. 验证邮箱和密码强度
 * 2. 检查邮箱是否已注册
 * 3. 生成密码哈希和盐值
 * 4. 创建用户记录
 * 5. 分配初始权限
 * 6. 生成访问令牌和刷新令牌
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 注册结果和令牌
 */
/**
 * 自动生成用户昵称
 * 基于邮箱地址生成友好的昵称
 *
 * @param {string} email - 用户邮箱
 * @returns {string} 生成的昵称
 */
function generateNickname(email) {
  // 提取邮箱用户名部分（@ 之前）
  const username = email.split('@')[0] || 'user'

  // 生成随机后缀（4位数字）
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)

  // 格式化：首字母大写 + 随机后缀
  const formatted =
    username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()

  return `${formatted}${randomSuffix}`
}

async function handleRegister(request, env) {
  try {
    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)
    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    // 临时注释掉验证，方便测试
    // if (!validateEmail(email)) {
    //   return errorJson(
    //     {
    //       error: 'invalid_email',
    //       message: '邮箱格式不正确',
    //       zh: '邮箱格式不正确',
    //       details: { minLength: EMAIL_MIN_LEN, example: 'name@example.com' }
    //     },
    //     400
    //   )
    // }
    // if (!validatePasswordStrength(password)) {
    //   const info = passwordStrengthDetails(password)
    //   return errorJson(
    //     {
    //       error: 'weak_password',
    //       message: '密码不符合安全要求',
    //       zh: '密码不符合安全要求',
    //       details: info
    //     },
    //     400
    //   )
    // }
    const existing = await mod.getUserByEmail(env, email)
    if (existing)
      return errorJson(
        {
          error: 'email_already_registered'
        },
        HTTP_CONFLICT
      )
    const deriv = await deriveNewPassword(password, PWD_ITER)
    const userId = `local:${email.toLowerCase()}`
    // 自动生成昵称
    const nickname = generateNickname(email)
    await mod.createUserWithPassword(env, {
      id: userId,
      email,
      hash: deriv.hash,
      salt: deriv.salt,
      algo: deriv.algo,
      iter: deriv.iter,
      nickname
    })
    await mod.upsertEntitlements(env, userId, 'free', {}, 0)
    const access = await signAccess(
      env,
      { sub: userId, email, tier: 'free', features: {} },
      ACCESS_TTL
    )
    const ref = await newRefreshForUser(env, mod, userId)
    return okJson({
      success: true,
      accessToken: access,
      refreshToken: ref.token,
      expiresIn: ACCESS_TTL
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理密码登录请求
 *
 * 流程：
 * 1. 验证邮箱和密码
 * 2. 检查账户锁定状态
 * 3. 验证密码哈希
 * 4. 记录登录成功/失败
 * 5. 生成访问令牌和刷新令牌
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 登录结果和令牌
 */
async function handlePasswordLogin(request, env) {
  try {
    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)
    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    if (!validateEmail(email))
      return errorJson({ error: 'invalid email or password' }, 400)
    const user = await mod.getUserByEmail(env, email)
    // generic error message
    if (!user || !user.password_hash || !user.password_salt)
      return errorJson({ error: 'invalid email or password' }, 400)
    const now = Date.now()
    if (Number(user.locked_until || 0) > now)
      return errorJson({ error: 'account temporarily locked' }, HTTP_LOCKED)
    const computed = await hashPassword(
      password,
      String(user.password_salt),
      Number(user.password_iter || PWD_ITER)
    )
    if (computed !== String(user.password_hash)) {
      const attempts = Number(user.failed_attempts || 0) + 1
      const willLock = attempts >= LOCK_FAIL_MAX ? now + LOCK_WINDOW_MS : 0
      await mod.recordLoginFailure(env, user.id, willLock)
      return errorJson({ error: 'invalid email or password' }, 400)
    }
    await mod.recordLoginSuccess(env, user.id, getIp(request))
    const access = await signAccess(
      env,
      { sub: user.id, email: user.email, tier: 'free', features: {} },
      ACCESS_TTL
    )
    const ref = await newRefreshForUser(env, mod, user.id)
    return okJson({
      success: true,
      accessToken: access,
      refreshToken: ref.token,
      expiresIn: ACCESS_TTL
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理刷新令牌请求
 *
 * 使用刷新令牌获取新的访问令牌
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 新的访问令牌
 */
async function handleRefresh(request, env) {
  try {
    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)
    const body = await request.json().catch(() => ({}))
    const token = String(body.refreshToken || '')
    if (!token) return errorJson({ error: 'missing refreshToken' }, 400)
    const tokenHash = await sha256Base64Url(token)
    const row = await mod.findRefreshTokenByHash(env, tokenHash)
    if (!row) return errorJson({ error: 'invalid refreshToken' }, 401)
    const nowSec = Math.floor(Date.now() / 1000)
    if (Number(row.expires_at || 0) < nowSec) {
      await mod.revokeRefreshToken(env, row.id)
      return errorJson({ error: 'expired refreshToken' }, 401)
    }
    // rotate
    await mod.revokeRefreshToken(env, row.id)
    const fresh = await newRefreshForUser(env, mod, row.user_id)
    const access = await signAccess(env, { sub: row.user_id }, ACCESS_TTL)
    return okJson({
      success: true,
      accessToken: access,
      refreshToken: fresh.token,
      expiresIn: ACCESS_TTL
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理忘记密码请求
 *
 * 生成密码重置令牌（实际应用中应发送重置邮件）
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 重置令牌（仅用于开发/演示）
 */
async function handleForgotPassword(request, env) {
  try {
    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)
    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim()
    if (!validateEmail(email)) return okJson({ success: true }) // 不暴露
    const user = await mod.getUserByEmail(env, email)
    if (!user) return okJson({ success: true })
    const token = await randomBase64Url(24)
    const exp = Date.now() + RESET_TTL * 1000
    await mod.createPasswordReset(env, {
      token,
      userId: user.id,
      expiresAt: exp,
      ip: getIp(request)
    })
    // 邮件服务后续接入；开发阶段可在 dev 模式返回 token 便于验证
    const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
    return okJson({ success: true, ...(allowDev ? { token } : {}) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理重置密码请求
 *
 * 使用重置令牌设置新密码
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 重置结果
 */
async function handleResetPassword(request, env) {
  try {
    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)
    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '')
    const newPassword = String(body.newPassword || '')
    if (!token) {
      return errorJson(
        {
          error: 'invalid_token',
          message: '重置令牌无效或缺失',
          zh: '重置令牌无效或缺失'
        },
        400
      )
    }
    if (!validatePasswordStrength(newPassword)) {
      const info = passwordStrengthDetails(newPassword)
      return errorJson(
        {
          error: 'weak_password',
          message: '密码不符合安全要求',
          zh: '密码不符合安全要求',
          details: info
        },
        400
      )
    }
    const res = await mod.consumePasswordReset(env, token)
    if (!res || res.error)
      return errorJson({ error: 'invalid or expired token' }, 400)
    const deriv = await deriveNewPassword(newPassword, PWD_ITER)
    await mod.setPassword(env, res.userId, deriv)
    await mod.revokeAllRefreshTokensForUser(env, res.userId)
    return okJson({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理修改密码请求
 *
 * 已登录用户修改密码，需要验证旧密码
 *
 * @param {Request} request - HTTP 请求对象
 * @param {object} env - Cloudflare Worker 环境对象
 * @returns {Promise<Response>} 修改结果
 */
async function handleChangePassword(request, env) {
  try {
    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)
    const token = parseBearer(request)
    if (!token) return errorJson({ error: 'unauthorized' }, 401)
    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
    const v = await verifyJWT(secret, token)
    if (!v.ok) return errorJson({ error: 'unauthorized' }, 401)
    const body = await request.json().catch(() => ({}))
    const oldPassword = String(body.oldPassword || '')
    const newPassword = String(body.newPassword || '')
    if (!validatePasswordStrength(newPassword)) {
      const info = passwordStrengthDetails(newPassword)
      return errorJson(
        {
          error: 'weak_password',
          message: '密码不符合安全要求',
          zh: '密码不符合安全要求',
          details: info
        },
        400
      )
    }
    const user = await mod.getUserById(env, v.payload?.sub)
    if (!user || !user.password_hash || !user.password_salt)
      return errorJson({ error: 'unauthorized' }, 401)
    const computed = await hashPassword(
      oldPassword,
      String(user.password_salt),
      Number(user.password_iter || PWD_ITER)
    )
    if (computed !== String(user.password_hash))
      return errorJson({ error: 'invalid old password' }, 400)
    const deriv = await deriveNewPassword(newPassword, PWD_ITER)
    await mod.setPassword(env, user.id, deriv)
    await mod.revokeAllRefreshTokensForUser(env, user.id)
    return okJson({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}
// === 安全与校验工具 ===
/**
 * 读取布尔型环境变量，支持多种写法（大写、小写、字符串）。
 */
function getEnvFlag(env, key, defaultBool = false) {
  const v =
    env && (env[key] ?? env[key?.toUpperCase?.()] ?? env[key?.toLowerCase?.()])
  if (typeof v === 'boolean') return v
  if (typeof v === 'string')
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
  return defaultBool
}

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

async function verifyJWT(secret, token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return { ok: false, error: 'malformed' }
    const [p1, p2, sig] = parts
    const unsigned = `${p1}.${p2}`
    const expected = base64urlEncode(
      await hmacSign(new globalThis.TextEncoder().encode(secret), unsigned)
    )
    if (expected !== sig) return { ok: false, error: 'bad-signature' }
    const payloadJson = globalThis.atob(
      p2.replace(/-/g, '+').replace(/_/g, '/')
    )
    const payload = JSON.parse(payloadJson)
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp === 'number' && now > payload.exp)
      return { ok: false, error: 'expired' }
    return { ok: true, payload }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * 从请求头解析 Bearer Token。
 */
function parseBearer(req) {
  const auth =
    req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : ''
}

/**
 * 返回当前用户信息（未登录则返回匿名状态）。
 */
async function handleUserMe(request, env) {
  try {
    const token = parseBearer(request)
    if (!token)
      return okJson({
        success: true,
        user: null,
        tier: 'free',
        features: {},
        expiresAt: 0
      })
    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
    const v = await verifyJWT(secret, token)
    if (!v.ok)
      return okJson({
        success: true,
        user: null,
        tier: 'free',
        features: {},
        expiresAt: 0
      })
    const p = v.payload || {}
    const userId = p.sub || p.userId || 'u'

    // 从数据库获取用户信息（包括昵称）
    let nickname = null
    try {
      const { ok, mod } = await mustD1(env)
      if (ok) {
        const user = await mod.getUserById(env, userId)
        if (user?.nickname) {
          ;({ nickname } = user)
        }
      }
    } catch (e) {
      // 忽略数据库错误，继续返回基本信息
      console.error('handleUserMe failed', e)
    }

    return okJson({
      success: true,
      user: {
        id: userId,
        email: p.email || undefined,
        nickname: nickname || undefined
      },
      tier: p.tier || 'free',
      features: p.features || {},
      expiresAt: p.exp || 0
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * 处理用户昵称更新请求
 * PUT /api/user/nickname
 */
async function handleUserNickname(request, env) {
  try {
    const token = parseBearer(request)
    if (!token) return errorJson({ error: 'unauthorized' }, 401)

    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
    const v = await verifyJWT(secret, token)
    if (!v.ok) return errorJson({ error: 'invalid_token' }, 401)

    const p = v.payload || {}
    const userId = p.sub || p.userId
    if (!userId) return errorJson({ error: 'invalid_user' }, 400)

    const { ok, mod } = await mustD1(env)
    if (!ok) return errorJson({ error: 'database not configured' }, 501)

    const body = await request.json().catch(() => ({}))
    const nickname = String(body.nickname || '').trim()

    // 验证昵称长度（1-20 个字符）
    if (nickname.length === 0) {
      return errorJson({ error: 'nickname_required' }, 400)
    }
    if (nickname.length > 20) {
      return errorJson({ error: 'nickname_too_long' }, 400)
    }

    // 更新昵称
    await mod.updateUserNickname(env, userId, nickname)

    return okJson({
      success: true,
      nickname
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

// 开发用：无 OAuth 也能发测试令牌；生产需关闭或受保护
/**
 * Dev 登录接口：用于本地或测试环境直接签发高权限令牌。
 */
async function handleDevLogin(request, env) {
  try {
    // 环境门禁：必须显式允许
    const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
    if (!allowDev) return errorJson({ error: 'dev-login disabled' }, 403)
    const url = new URL(request.url)
    const tier = (url.searchParams.get('tier') || 'pro').toLowerCase()
    const email = url.searchParams.get('user') || 'dev@example.com'
    const expiresIn = Number(url.searchParams.get('expiresIn') || 24 * 60 * 60) // 1 天
    const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
    const token = await signJWT(
      secret,
      { sub: `dev:${email}`, email, tier, features: { pro: tier === 'pro' } },
      expiresIn
    )
    const now = Math.floor(Date.now() / 1000)
    return okJson({
      success: true,
      token,
      tier,
      user: { email },
      expiresAt: now + expiresIn
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
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
    const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
    const gCfg = getProviderConfig('google', env)
    const google = Boolean(gCfg)
    const googleHasSecret = Boolean(gCfg && gCfg.clientSecret)
    const ghCfg = getProviderConfig('github', env)
    const github = Boolean(ghCfg)
    const githubHasSecret = Boolean(ghCfg && ghCfg.clientSecret)
    const allow = parseAllowlist(env)
    return okJson({
      success: true,
      providers: {
        dev: allowDev,
        google,
        googleHasSecret,
        github,
        githubHasSecret
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
 * OAuth 授权起点，返回跳转 URL 或模拟 dev 授权流程。
 *
 * @param {Request} request - 原始请求
 * @param {Record<string, unknown>} _env - Cloudflare 环境变量
 * @returns {Response} JSON 响应，包含授权信息
 */
function handleAuthStart(request, _env) {
  try {
    const url = new URL(request.url)
    const provider = (url.searchParams.get('provider') || 'dev').toLowerCase()
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
    // dev provider: immediately authorize via our worker and bounce back to extension redirect
    if (provider === 'dev') {
      const allowDev = getEnvFlag(_env, 'ALLOW_DEV_LOGIN', false)
      if (!allowDev) return errorJson({ error: 'dev auth disabled' }, 403)
      const state =
        url.searchParams.get('state') || Math.random().toString(36).slice(2)
      const authUrl = new URL('/auth/dev/authorize', url)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('state', state)
      return okJson({
        success: true,
        provider,
        authUrl: authUrl.toString(),
        state
      })
    }
    const cfg = getProviderConfig(provider, _env)
    if (!cfg) {
      const missing =
        provider === 'google'
          ? ['AUTH_GOOGLE_CLIENT_ID'].filter(k => !_env?.[k])
          : provider === 'github'
            ? ['AUTH_GITHUB_CLIENT_ID'].filter(k => !_env?.[k])
            : []
      return errorJson(
        { error: `provider not configured: ${provider}`, missing },
        400
      )
    }
    const s =
      url.searchParams.get('state') || Math.random().toString(36).slice(2)
    const a = new URL(cfg.authUrl)
    a.searchParams.set('response_type', 'code')
    a.searchParams.set('client_id', cfg.clientId)
    a.searchParams.set('redirect_uri', redirectUri)
    if (codeChallenge) {
      a.searchParams.set('code_challenge', codeChallenge)
      a.searchParams.set('code_challenge_method', 'S256')
    }
    a.searchParams.set('scope', scope || cfg.scope || '')
    a.searchParams.set('state', s)
    if (provider === 'google') {
      a.searchParams.set('prompt', 'consent')
      a.searchParams.set('access_type', 'offline')
    }
    return okJson({ success: true, provider, authUrl: a.toString(), state: s })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

/**
 * Dev Provider 回调：模拟授权流程并重定向回扩展。
 *
 * @param {Request} request - 原始请求
 * @param {Record<string, unknown>} _env - Cloudflare 环境变量
 * @returns {Response} 302 重定向
 */
function handleAuthDevAuthorize(request, _env) {
  try {
    const url = new URL(request.url)
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const state = url.searchParams.get('state') || ''
    if (!redirectUri) return errorJson({ error: 'missing redirect_uri' }, 400)
    const allowDev = getEnvFlag(_env, 'ALLOW_DEV_LOGIN', false)
    if (!allowDev) return errorJson({ error: 'dev auth disabled' }, 403)
    const redirCheck = isAllowedRedirectUri(redirectUri, _env)
    if (!redirCheck.ok)
      return errorJson(
        { error: `invalid redirect_uri: ${redirCheck.error}` },
        400
      )
    const code = Math.random().toString(36).slice(2)
    const redirect = new URL(redirectUri)
    redirect.searchParams.set('code', code)
    if (state) redirect.searchParams.set('state', state)
    return new Response(null, {
      status: 302,
      headers: { Location: redirect.toString(), ...corsHeaders }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

async function handleAuthCallback(request, env) {
  try {
    const url = new URL(request.url)
    const provider = (url.searchParams.get('provider') || 'dev').toLowerCase()
    const code = url.searchParams.get('code') || ''
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const codeVerifier = url.searchParams.get('code_verifier') || ''
    if (!code) return errorJson({ error: 'missing code' }, 400)
    // For dev provider, mint a token directly
    if (provider === 'dev') {
      const allowDev = getEnvFlag(env, 'ALLOW_DEV_LOGIN', false)
      if (!allowDev) return errorJson({ error: 'dev auth disabled' }, 403)
      const email = `user+${code}@example.com`
      const tier = 'pro'
      const secret = env.JWT_SECRET || env.SECRET || 'dev-secret'
      const token = await signJWT(
        secret,
        { sub: `dev:${email}`, email, tier, features: { pro: true } },
        24 * 60 * 60
      )
      const now = Math.floor(Date.now() / 1000)
      return okJson({
        success: true,
        token,
        tier,
        user: { email },
        expiresAt: now + 24 * 60 * 60
      })
    }
    // google/github exchange with PKCE
    const cfg = getProviderConfig(provider, env)
    if (!cfg) {
      const missing =
        provider === 'google'
          ? ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'].filter(
              k => !env?.[k]
            )
          : provider === 'github'
            ? ['AUTH_GITHUB_CLIENT_ID', 'AUTH_GITHUB_CLIENT_SECRET'].filter(
                k => !env?.[k]
              )
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
    await persistUserEntitlements(env, userId, email, provider, sub)
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
  if (provider === 'github') {
    const clientId = env.AUTH_GITHUB_CLIENT_ID
    const clientSecret = env.AUTH_GITHUB_CLIENT_SECRET
    const authUrl =
      env.AUTH_GITHUB_AUTH_URL || 'https://github.com/login/oauth/authorize'
    const tokenUrl =
      env.AUTH_GITHUB_TOKEN_URL || 'https://github.com/login/oauth/access_token'
    const userInfoUrl =
      env.AUTH_GITHUB_USERINFO_URL || 'https://api.github.com/user'
    if (!clientId) return null
    return {
      provider,
      clientId,
      clientSecret,
      authUrl,
      tokenUrl,
      userInfoUrl,
      scope: 'read:user user:email'
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

/**
 * 将 OAuth 用户写入 D1，并赋予默认权益。
 *
 * @param {Record<string, unknown>} env - Cloudflare 环境变量
 * @param {string} userId - 内部用户 ID
 * @param {string} email - 用户邮箱
 * @param {string} provider - OAuth Provider 名称
 * @param {string} providerId - Provider 内部用户标识
 * @returns {Promise<void>} 无返回值
 */
async function persistUserEntitlements(
  env,
  userId,
  email,
  provider,
  providerId
) {
  try {
    const d1 = await import('./utils/d1.js')
    // Ensure schema exists once per worker process to avoid "no such table" being swallowed
    if (typeof globalThis.__AB_SCHEMA_INITED === 'undefined') {
      try {
        await d1.ensureSchema(env)
        globalThis.__AB_SCHEMA_INITED = true
      } catch (e) {
        // If schema init fails (e.g., no DB bound), mark as false but continue gracefully
        globalThis.__AB_SCHEMA_INITED = false
        console.warn(
          '[D1] ensureSchema failed or no DB bound:',
          e && (e.message || e)
        )
      }
    }
    await d1.upsertUser(env, { id: userId, email, provider, providerId })
    await d1.upsertEntitlements(env, userId, 'free', {}, 0)
  } catch (e) {
    // Keep auth flow non-fatal, but surface a hint in logs for diagnostics
    console.warn('[D1] persistUserEntitlements skipped:', e && (e.message || e))
  }
}

// ===================== Lemon Squeezy Integration =====================
// Lemon Squeezy handlers will be loaded dynamically when needed
