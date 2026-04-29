import type { Ai, ExecutionContext } from '@cloudflare/workers-types'

export interface Env {
  // Bindings
  AI: Ai

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
/** 接受的 HTML 内容类型列表，偏向常见网页格式。 */
const ACCEPT_HTML =
  'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
/** 默认允许的重定向域后缀，用于 Chrome 扩展 WebAuthFlow。 */
const DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES = ['.chromiumapp.org']

/** 统一 CORS 响应头配置，允许跨域访问 REST 接口。 */
const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
}

const okJson = (data: unknown): Response =>
  new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })

const errorJson = (data: unknown, status = 500): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders }
  })

function handleOptions(): Response {
  return new Response(null, { headers: corsHeaders })
}

function handleHealth(): Response {
  return okJson({
    status: 'ok',
    runtime: 'cloudflare-worker',
    timestamp: new Date().toISOString()
  })
}

// ===================== AI =====================

/**
 * 处理 AI 文本补全请求
 */
async function handleAIComplete(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url)
    const body: any =
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

    const answer = await env.AI.run(model as any, params)
    if (stream)
      return new Response(answer as any, {
        headers: { 'content-type': 'text/event-stream', ...corsHeaders }
      })
    return okJson(answer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

// ===================== Crawl =====================

/**
 * 处理网页爬取请求
 */
async function handleCrawl(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url)
    let targetUrl = url.searchParams.get('url') || ''
    if (!targetUrl && request.method === 'POST') {
      const body: any = await request.json().catch(() => ({}))
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
      ogSiteName: getMeta('property', 'og:site-name')
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

// ===================== Worker 入口 =====================

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './router'
import { createContext } from './trpc'
import { logRequest, logResponse, logError } from './utils/logger'

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const startTime = Date.now()
    const url = new URL(request.url)

    logRequest(request)

    try {
      // tRPC
      if (url.pathname.startsWith('/trpc')) {
        const response = await fetchRequestHandler({
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
        logResponse(request, response, Date.now() - startTime)
        return response
      }

      if (request.method === 'OPTIONS') {
        const response = handleOptions()
        logResponse(request, response, Date.now() - startTime)
        return response
      }

      const ROUTES = {
        '/api/health': () => handleHealth(),
        '/health': () => handleHealth(),
        // Admin
        '/api/admin/env/check': () => handleAdminEnvCheck(request, env),
        // Auth
        '/api/auth/start': () => handleAuthStart(request, env),
        '/api/auth/callback': () => handleAuthCallback(request, env),
        '/api/auth/providers': () => handleAuthProviders(request, env),
        // AI
        '/api/ai/complete': () => handleAIComplete(request, env),
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
        logResponse(request, result, Date.now() - startTime)
        return result
      }

      const notFoundResponse = new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      })
      logResponse(request, notFoundResponse, Date.now() - startTime)
      return notFoundResponse
    } catch (err) {
      logError(err, {
        method: request.method,
        path: url.pathname,
        duration: Date.now() - startTime
      })
      const errorResponse = new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      })
      logResponse(request, errorResponse, Date.now() - startTime)
      return errorResponse
    }
  }
}

// ===================== Admin =====================

function pickExisting(env, keys) {
  const out = {}
  for (const k of keys) {
    if (env && env[k] !== undefined)
      out[k] =
        typeof env[k] === 'string' && env[k].length > 0 ? '(set)' : '(empty)'
  }
  return out
}

function listMissing(env, keys) {
  return keys.filter(k => !env || !env[k])
}

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

function handleAdminEnvCheck(_request, env) {
  try {
    const report = buildEnvReport(env)
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

// ===================== 安全与校验工具 =====================

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

function isHttpsLikeLocal(u) {
  return (
    u.protocol === 'https:' &&
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  )
}

function isAllowedRedirectUri(redirectUri, env) {
  try {
    const u = new URL(redirectUri)
    const scheme = u.protocol
    if (
      scheme !== 'https:' &&
      scheme !== 'chrome-extension:' &&
      !isHttpsLikeLocal(u)
    ) {
      return { ok: false, error: 'unsupported scheme' }
    }
    if (scheme === 'https:') {
      const host = u.hostname.toLowerCase()
      if (
        !DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES.some(suf => host.endsWith(suf))
      ) {
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
    if (scheme === 'javascript:' || scheme === 'data:')
      return { ok: false, error: 'dangerous scheme' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'invalid redirect_uri' }
  }
}

// ===================== Auth & JWT =====================

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
      providers: { google, googleHasSecret, microsoft, microsoftHasSecret },
      redirectAllowlist: allow.length ? allow : undefined,
      note: '默认放行 https://*.chromiumapp.org 作为 Chrome 扩展回调域'
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return errorJson({ error: msg }, 500)
  }
}

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
    if (!['google', 'microsoft'].includes(provider)) {
      return errorJson({ error: `unsupported provider: ${provider}` }, 400)
    }
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
  const tokenJson: any = await tokenResp.json().catch(() => ({}))
  const accessToken = tokenJson.access_token
  if (!accessToken) throw new Error('missing access_token')
  return accessToken
}

async function fetchUserInfoWithAccessToken(provider, cfg, accessToken) {
  if (provider === 'google') {
    const uResp = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const u: any = await uResp.json().catch(() => ({}))
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
    const u: any = await uResp.json().catch(() => ({}))
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
