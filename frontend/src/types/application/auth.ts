export type Tier = 'free' | 'pro'

export interface AuthConfig {
  graceSeconds: number
  refreshThreshold: number
  apiBase: string
}

export interface EntitlementResult {
  ok: boolean
  tier: Tier
  email?: string
  expiresAt: number
  from: 'token' | 'grace' | 'network' | 'none'
}

export interface AuthToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface UserProfile {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}

export const AUTH_TOKEN_STORAGE_KEY = 'ab_auth_token'

export function isAuthToken(token: unknown): token is AuthToken {
  if (!token || typeof token !== 'object') return false
  const candidate = token as Partial<AuthToken>
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number'
  )
}
