/**
 * 轻量权益门控（Auth Gate）
 * - 从 JWT 解析 tier/exp
 * - 支持离线宽限（exp 之后继续有效一段时间）
 * - 可选优先网络刷新 /api/user/me
 */
import { settingsAppService } from '@/application/settings/settings-app-service'
import { API_CONFIG } from '../config/constants'

export type Tier = 'free' | 'pro'

export interface EntitlementResult {
  ok: boolean
  tier: Tier
  email?: string
  expiresAt: number // seconds since epoch
  from: 'network' | 'token' | 'grace' | 'none'
}

export const AUTH_TOKEN_KEY = 'auth.jwt'
export const AUTH_GRACE_SECONDS = Number((import.meta as any).env.VITE_AUTH_GRACE_SECONDS || (3 * 24 * 60 * 60))
export const AUTH_REFRESH_KEY = 'auth.refresh'

function base64urlDecode(str: string): string {
  try {
    const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : ''
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad
    // atob 在扩展上下文可用
    return atob(b64)
  } catch {
    return ''
  }
}

export function computeEntitlementFromToken(token: string | null | undefined, nowSec = Math.floor(Date.now() / 1000), graceSec = AUTH_GRACE_SECONDS): EntitlementResult {
  if (!token || typeof token !== 'string') return { ok: true, tier: 'free', expiresAt: 0, from: 'none' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: true, tier: 'free', expiresAt: 0, from: 'none' }
  try {
    const payloadJson = base64urlDecode(parts[1])
    const payload = JSON.parse(payloadJson || '{}') as { tier?: Tier; email?: string; exp?: number }
    const exp = Number(payload.exp || 0)
    const within = nowSec <= exp
    if (within) {
      return { ok: true, tier: (payload.tier === 'pro' ? 'pro' : 'free'), email: payload.email, expiresAt: exp, from: 'token' }
    }
    // 过期后进入宽限期
    if (exp > 0 && nowSec <= exp + Math.max(0, graceSec)) {
      return { ok: true, tier: (payload.tier === 'pro' ? 'pro' : 'free'), email: payload.email, expiresAt: exp, from: 'grace' }
    }
    return { ok: true, tier: 'free', email: payload.email, expiresAt: exp || 0, from: 'token' }
  } catch {
    return { ok: true, tier: 'free', expiresAt: 0, from: 'none' }
  }
}

export async function getEntitlement(preferNetwork: boolean = true): Promise<EntitlementResult> {
  // 优先确保 Access Token 新鲜（如即将过期则尝试刷新）
  await ensureFreshTokenSafely()
  let token: string | null = null
  try {
    token = await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY)
  } catch {
    token = null
  }
  const fallback = computeEntitlementFromToken(token)
  if (!preferNetwork || !token) return fallback

  try {
    const resp = await fetch(`${API_CONFIG.API_BASE}/api/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    })
    const data = await resp.json().catch(() => ({}))
    if (data && data.success) {
      const tier: Tier = data.tier === 'pro' ? 'pro' : 'free'
      const email: string | undefined = data.user?.email
      const expiresAt: number = Number(data.expiresAt || 0)
      return { ok: true, tier, email, expiresAt, from: 'network' }
    }
    return fallback
  } catch {
    return fallback
  }
}

export async function isPro(preferNetwork: boolean = false): Promise<boolean> {
  const ent = await getEntitlement(preferNetwork)
  if (ent.tier === 'pro') return true
  return false
}

export async function getToken(): Promise<string | null> {
  try {
    return await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  await settingsAppService.saveSetting(AUTH_TOKEN_KEY, token, 'string', 'JWT auth token')
}

export async function clearToken(): Promise<void> {
  await settingsAppService.deleteSetting(AUTH_TOKEN_KEY)
}

// === 刷新 Token 相关 ===
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await settingsAppService.getSetting<string>(AUTH_REFRESH_KEY)
  } catch {
    return null
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  await settingsAppService.saveSetting(AUTH_REFRESH_KEY, token, 'string', 'JWT refresh token')
}

export async function clearRefreshToken(): Promise<void> {
  await settingsAppService.deleteSetting(AUTH_REFRESH_KEY)
}

export async function saveAuthTokens(accessToken: string, refreshToken?: string | null): Promise<void> {
  await setToken(accessToken)
  if (refreshToken) await setRefreshToken(refreshToken)
}

/**
 * 若 Access Token 即将过期（< 120s）或已过期但在宽限期内，尝试使用 Refresh Token 刷新。
 * 无刷新令牌或刷新失败时静默返回。
 */
export async function ensureFreshTokenSafely(): Promise<void> {
  let access: string | null = null
  try { access = await settingsAppService.getSetting<string>(AUTH_TOKEN_KEY) } catch { access = null }
  if (!access) return
  const nowSec = Math.floor(Date.now() / 1000)
  const ent = computeEntitlementFromToken(access, nowSec)
  const secondsLeft = (ent.expiresAt || 0) - nowSec
  if (secondsLeft > 120) return // 还有足够的时间
  // 尝试刷新
  const refresh = await getRefreshToken()
  if (!refresh) return
  try {
    const resp = await fetch(`${API_CONFIG.API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
      signal: AbortSignal.timeout(5000)
    })
    if (!resp.ok) return
    const data = await resp.json().catch(() => ({} as any))
    if (data && data.success && data.access_token) {
      await saveAuthTokens(String(data.access_token), data.refresh_token ? String(data.refresh_token) : null)
    }
  } catch {
    // 静默失败
  }
}
