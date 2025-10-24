export interface ApiResponse<T> {
  ok: boolean
  data: T
  status: number
  headers?: Record<string, string>
}

export interface ApiError {
  status: number
  message: string
  details?: Record<string, unknown>
}

export interface BookmarkCreateDetails {
  parentId?: string
  index?: number
  title?: string
  url?: string
}

export interface BookmarkDestination {
  parentId?: string
  index?: number
}

export interface BookmarkUpdateDetails {
  title?: string
  url?: string
}

export interface AuthStartResponse {
  success: boolean
  authUrl: string
}

export interface AuthCallbackResponse {
  success: boolean
  token?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  error?: string
}

export interface LoginResponse {
  success: boolean
  access_token?: string
  refresh_token?: string
  error?: string
}

export interface BasicOk {
  success: boolean
  error?: string
}

export interface MeResponse {
  success: boolean
  user?: {
    email: string
    tier: 'free' | 'pro'
    expiresAt?: number
  }
}
