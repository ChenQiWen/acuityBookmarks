/**
 * 付费等级枚举。
 *
 * - `free`：免费版
 * - `pro`：专业版
 */
export type Tier = 'free' | 'pro'

/**
 * 认证相关的全局配置。
 */
export interface AuthConfig {
  /** 无网络时允许继续使用的宽限秒数 */
  graceSeconds: number
  /** 在令牌过期前多少秒触发刷新 */
  refreshThreshold: number
  /** 后端 API 基础地址 */
  apiBase: string
}

/**
 * 授权校验结果。
 */
export interface EntitlementResult {
  /** 是否成功取得授权 */
  ok: boolean
  /** 用户等级 */
  tier: Tier
  /** 邮箱（某些接口可能缺失） */
  email?: string
  /** 订阅到期时间戳（毫秒） */
  expiresAt: number
  /** 权限来源：令牌、宽限模式、网络校验等 */
  from: 'token' | 'grace' | 'network' | 'none'
}

/**
 * 前端持久化保存的认证令牌。
 */
export interface AuthToken {
  /** 访问令牌 */
  accessToken: string
  /** 刷新令牌 */
  refreshToken: string
  /** 到期时间戳（毫秒） */
  expiresAt: number
}

/**
 * 用户资料快照。
 */
export interface UserProfile {
  /** 用户唯一 ID */
  id: string
  /** 注册邮箱 */
  email: string
  /** 显示名称 */
  displayName: string
  /** 头像 URL，可为空 */
  avatarUrl?: string
}

/** 浏览器本地存储认证信息时使用的 key。 */
export const AUTH_TOKEN_STORAGE_KEY = 'ab_auth_token'

/**
 * 类型守卫：判断对象是否为 `AuthToken`。
 */
export function isAuthToken(token: unknown): token is AuthToken {
  if (!token || typeof token !== 'object') return false
  const candidate = token as Partial<AuthToken>
  return (
    typeof candidate.accessToken === 'string' &&
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.expiresAt === 'number'
  )
}
