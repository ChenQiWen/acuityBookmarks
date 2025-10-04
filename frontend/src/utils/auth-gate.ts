/**
 * 轻量权益门控（Auth Gate）
 * - 从 JWT 解析 tier/exp
 * - 支持离线宽限（exp 之后继续有效一段时间）
 * - 可选优先网络刷新 /api/user/me
 */
import { unifiedBookmarkAPI } from './unified-bookmark-api'
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
  let token: string | null = null
  try {
    token = await unifiedBookmarkAPI.getSetting<string>(AUTH_TOKEN_KEY)
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
    return await unifiedBookmarkAPI.getSetting<string>(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  await unifiedBookmarkAPI.saveSetting(AUTH_TOKEN_KEY, token, 'string', 'JWT auth token')
}

export async function clearToken(): Promise<void> {
  await unifiedBookmarkAPI.deleteSetting(AUTH_TOKEN_KEY)
}
