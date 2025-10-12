/**
 * 认证应用层类型定义
 *
 * 包含认证和授权相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'

/**
 * 用户等级类型
 *
 * 用户的订阅等级
 */
export type Tier = 'free' | 'pro' | 'premium' | 'enterprise'

/**
 * 认证状态类型
 *
 * 用户的认证状态
 */
export type AuthStatus =
  | 'authenticated'
  | 'unauthenticated'
  | 'checking'
  | 'expired'

/**
 * 用户角色类型
 *
 * 用户的角色权限
 */
export type UserRole = 'admin' | 'user' | 'guest'

/**
 * 用户信息接口
 *
 * 用户的基本信息
 */
export interface UserInfo {
  /** 用户ID */
  id: ID

  /** 用户名 */
  username: string

  /** 邮箱 */
  email: string

  /** 显示名称 */
  displayName?: string

  /** 头像URL */
  avatarUrl?: string

  /** 用户角色 */
  role: UserRole

  /** 创建时间 */
  createdAt: Timestamp

  /** 最后登录时间 */
  lastLoginAt?: Timestamp

  /** 是否已验证邮箱 */
  emailVerified: boolean

  /** 用户偏好设置 */
  preferences?: Record<string, unknown>
}

/**
 * 认证令牌接口
 *
 * JWT 令牌信息
 */
export interface AuthToken {
  /** 访问令牌 */
  accessToken: string

  /** 刷新令牌 */
  refreshToken?: string

  /** 令牌类型 */
  tokenType: 'Bearer' | 'Basic'

  /** 过期时间 */
  expiresAt: Timestamp

  /** 发行时间 */
  issuedAt: Timestamp

  /** 发行者 */
  issuer?: string

  /** 用户ID */
  userId?: ID
}

/**
 * 登录凭证接口
 *
 * 用户登录时提供的凭证
 */
export interface LoginCredentials {
  /** 用户名或邮箱 */
  username: string

  /** 密码 */
  password: string

  /** 是否记住登录状态 */
  rememberMe?: boolean

  /** 验证码（如需要） */
  captcha?: string
}

/**
 * 注册信息接口
 *
 * 用户注册时提供的信息
 */
export interface RegisterInfo {
  /** 用户名 */
  username: string

  /** 邮箱 */
  email: string

  /** 密码 */
  password: string

  /** 确认密码 */
  confirmPassword: string

  /** 显示名称 */
  displayName?: string

  /** 邀请码 */
  inviteCode?: string

  /** 同意服务条款 */
  agreeToTerms: boolean
}

/**
 * 认证配置接口
 *
 * 认证服务的配置选项
 */
export interface AuthConfig {
  /** API 基础URL */
  apiBaseUrl: string

  /** 令牌存储键 */
  tokenStorageKey: string

  /** 是否启用自动刷新令牌 */
  autoRefreshToken: boolean

  /** 令牌刷新前置时间（毫秒） */
  refreshTokenBeforeExpiry: number

  /** 最大重试次数 */
  maxRetries: number

  /** 超时时间（毫秒） */
  timeout: number

  /** 是否使用安全存储 */
  useSecureStorage: boolean
}

/**
 * 认证状态接口
 *
 * 认证相关的状态管理
 */
export interface AuthState {
  /** 认证状态 */
  status: AuthStatus

  /** 当前用户信息 */
  user: UserInfo | null

  /** 认证令牌 */
  token: AuthToken | null

  /** 是否正在登录 */
  isLoggingIn: boolean

  /** 是否正在登出 */
  isLoggingOut: boolean

  /** 是否正在刷新令牌 */
  isRefreshingToken: boolean

  /** 最后错误 */
  lastError: string | null
}

/**
 * 权限类型
 *
 * 系统中的权限类型
 */
export type Permission =
  | 'read'
  | 'write'
  | 'delete'
  | 'share'
  | 'admin'
  | 'export'
  | 'import'

/**
 * 权限检查结果接口
 *
 * 权限检查的结果
 */
export interface PermissionCheckResult {
  /** 是否有权限 */
  hasPermission: boolean

  /** 缺少的权限 */
  missingPermissions?: Permission[]

  /** 原因 */
  reason?: string
}

/**
 * 会话信息接口
 *
 * 用户会话的详细信息
 */
export interface SessionInfo {
  /** 会话ID */
  id: ID

  /** 用户ID */
  userId: ID

  /** 创建时间 */
  createdAt: Timestamp

  /** 过期时间 */
  expiresAt: Timestamp

  /** IP地址 */
  ipAddress?: string

  /** 用户代理 */
  userAgent?: string

  /** 设备信息 */
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet'
    os?: string
    browser?: string
  }

  /** 是否活跃 */
  isActive: boolean

  /** 最后活动时间 */
  lastActivityAt?: Timestamp
}

/**
 * 密码重置请求接口
 *
 * 密码重置请求的信息
 */
export interface PasswordResetRequest {
  /** 邮箱 */
  email: string

  /** 重置令牌 */
  token?: string

  /** 新密码 */
  newPassword?: string

  /** 确认密码 */
  confirmPassword?: string
}

/**
 * 邮箱验证接口
 *
 * 邮箱验证的信息
 */
export interface EmailVerification {
  /** 验证令牌 */
  token: string

  /** 邮箱 */
  email: string

  /** 过期时间 */
  expiresAt: Timestamp
}

/**
 * 双因素认证配置接口
 *
 * 2FA 相关配置
 */
export interface TwoFactorAuthConfig {
  /** 是否启用 */
  enabled: boolean

  /** 2FA 方法 */
  method: 'totp' | 'sms' | 'email'

  /** 备份码 */
  backupCodes?: string[]

  /** 是否已验证 */
  verified: boolean

  /** 配置时间 */
  configuredAt?: Timestamp
}
