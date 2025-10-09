// 轻量共享 API 类型定义
export interface ApiBase {
  success?: boolean
  error?: string
}
export interface BasicOk extends ApiBase {}

// Auth flows
export interface AuthStartResponse extends ApiBase {
  authUrl?: string
}
export interface AuthCallbackResponse extends ApiBase {
  token?: string
}
export interface LoginResponse extends ApiBase {
  access_token?: string
  refresh_token?: string | null
}

// User
export interface MeResponse extends ApiBase {
  tier?: 'free' | 'pro'
  user?: { email?: string }
  expiresAt?: number
}
