/**
 * 认证服务 - 应用服务层
 *
 * 职责：
 * - 管理用户认证状态
 * - 处理JWT令牌的解析和验证
 * - 提供权益门控功能
 * - 处理令牌刷新
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'
import { apiClient } from '../../infrastructure/http/api-client'
import { logger } from '../../infrastructure/logging/logger'

// 从统一类型定义导入
import type { Tier, AuthConfig } from '@/types/application/auth'

/**
 * 权益结果接口
 *
 * @deprecated 请使用 @/types/application/auth 中的类型定义
 * 为保持向后兼容，暂时保留此接口定义
 */
export interface EntitlementResult {
  ok: boolean
  tier: Tier
  email?: string
  expiresAt: number // seconds since epoch
  from: 'network' | 'token' | 'grace' | 'none'
}

/**
 * 认证服务
 */
export class AuthService {
  private config: AuthConfig
  // Token keys for future use
  // private _tokenKey = 'auth.jwt'
  // private _refreshKey = 'auth.refresh'

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      graceSeconds: 3 * 24 * 60 * 60, // 3 days
      refreshThreshold: 120, // 2 minutes
      apiBase: '/api',
      ...config
    }
  }

  /**
   * 从JWT令牌计算权益
   */
  computeEntitlementFromToken(
    token: string | null | undefined,
    nowSec = Math.floor(Date.now() / 1000),
    graceSec = this.config.graceSeconds
  ): EntitlementResult {
    if (!token || typeof token !== 'string') {
      return { ok: true, tier: 'free', expiresAt: 0, from: 'none' }
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return { ok: true, tier: 'free', expiresAt: 0, from: 'none' }
    }

    try {
      const payloadJson = this.base64urlDecode(parts[1])
      const payload = JSON.parse(payloadJson || '{}') as {
        tier?: Tier
        email?: string
        exp?: number
      }

      const exp = Number(payload.exp || 0)
      const within = nowSec <= exp

      if (within) {
        return {
          ok: true,
          tier: payload.tier === 'pro' ? 'pro' : 'free',
          email: payload.email,
          expiresAt: exp,
          from: 'token'
        }
      }

      // 过期后进入宽限期
      if (exp > 0 && nowSec <= exp + Math.max(0, graceSec || 0)) {
        return {
          ok: true,
          tier: payload.tier === 'pro' ? 'pro' : 'free',
          email: payload.email,
          expiresAt: exp,
          from: 'grace'
        }
      }

      return {
        ok: true,
        tier: 'free',
        email: payload.email,
        expiresAt: exp || 0,
        from: 'token'
      }
    } catch {
      return { ok: true, tier: 'free', expiresAt: 0, from: 'none' }
    }
  }

  /**
   * 获取用户权益
   */
  async getEntitlement(
    preferNetwork: boolean = true
  ): Promise<Result<EntitlementResult, Error>> {
    try {
      // 优先确保 Access Token 新鲜
      await this.ensureFreshTokenSafely()

      const tokenResult = await this.getToken()
      const token = tokenResult.ok ? tokenResult.value : null

      const fallback = this.computeEntitlementFromToken(token)

      if (!preferNetwork || !token) {
        return ok(fallback)
      }

      try {
        const result = await apiClient.get<{
          success: boolean
          tier: string
          user?: { email: string }
          expiresAt: number
        }>(`${this.config.apiBase}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        })

        if (result.ok && result.value.data.success) {
          const data = result.value.data
          const tier: Tier = data.tier === 'pro' ? 'pro' : 'free'
          const email: string | undefined = data.user?.email
          const expiresAt: number = Number(data.expiresAt || 0)

          return ok({
            ok: true,
            tier,
            email,
            expiresAt,
            from: 'network'
          })
        }

        return ok(fallback)
      } catch {
        return ok(fallback)
      }
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 检查是否为Pro用户
   */
  async isPro(preferNetwork: boolean = false): Promise<Result<boolean, Error>> {
    const result = await this.getEntitlement(preferNetwork)
    if (result.ok) {
      return ok(result.value.tier === 'pro')
    }
    return result
  }

  /**
   * 获取访问令牌
   */
  async getToken(): Promise<Result<string | null, Error>> {
    try {
      // 这里需要从设置服务获取令牌
      // 暂时返回null，实际实现需要注入设置服务
      return ok(null)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 设置访问令牌
   */
  async setToken(token: string): Promise<Result<void, Error>> {
    try {
      // 这里需要保存到设置服务
      // 暂时返回成功，实际实现需要注入设置服务
      logger.info('AuthService', 'Token saved', { tokenLength: token.length })
      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 清除访问令牌
   */
  async clearToken(): Promise<Result<void, Error>> {
    try {
      // 这里需要从设置服务删除令牌
      // 暂时返回成功，实际实现需要注入设置服务
      logger.info('AuthService', 'Token cleared')
      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 获取刷新令牌
   */
  async getRefreshToken(): Promise<Result<string | null, Error>> {
    try {
      // 这里需要从设置服务获取刷新令牌
      // 暂时返回null，实际实现需要注入设置服务
      return ok(null)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 设置刷新令牌
   */
  async setRefreshToken(token: string): Promise<Result<void, Error>> {
    try {
      // 这里需要保存到设置服务
      // 暂时返回成功，实际实现需要注入设置服务
      logger.info('AuthService', 'Refresh token saved', {
        tokenLength: token.length
      })
      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 清除刷新令牌
   */
  async clearRefreshToken(): Promise<Result<void, Error>> {
    try {
      // 这里需要从设置服务删除刷新令牌
      // 暂时返回成功，实际实现需要注入设置服务
      logger.info('AuthService', 'Refresh token cleared')
      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 保存认证令牌
   */
  async saveAuthTokens(
    accessToken: string,
    refreshToken?: string | null
  ): Promise<Result<void, Error>> {
    try {
      const setTokenResult = await this.setToken(accessToken)
      if (!setTokenResult.ok) {
        return setTokenResult
      }

      if (refreshToken) {
        const setRefreshResult = await this.setRefreshToken(refreshToken)
        if (!setRefreshResult.ok) {
          return setRefreshResult
        }
      }

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 确保令牌新鲜
   * 若 Access Token 即将过期或已过期但在宽限期内，尝试使用 Refresh Token 刷新
   */
  async ensureFreshTokenSafely(): Promise<Result<void, Error>> {
    try {
      const tokenResult = await this.getToken()
      if (!tokenResult.ok || !tokenResult.value) {
        return ok(undefined)
      }

      const access = tokenResult.value
      const nowSec = Math.floor(Date.now() / 1000)
      const ent = this.computeEntitlementFromToken(access, nowSec)
      const secondsLeft = (ent.expiresAt || 0) - nowSec

      if (secondsLeft > (this.config.refreshThreshold || 0)) {
        return ok(undefined) // 还有足够的时间
      }

      // 尝试刷新
      const refreshResult = await this.getRefreshToken()
      if (!refreshResult.ok || !refreshResult.value) {
        return ok(undefined)
      }

      const refresh = refreshResult.value

      try {
        const result = await apiClient.post<{
          success: boolean
          access_token: string
          refresh_token?: string
        }>(
          `${this.config.apiBase}/auth/refresh`,
          {
            refresh_token: refresh
          },
          {
            timeout: 5000
          }
        )

        if (result.ok && result.value.data.success) {
          const data = result.value.data
          await this.saveAuthTokens(
            data.access_token,
            data.refresh_token || null
          )
        }
      } catch {
        // 静默失败
      }

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * Base64URL解码
   */
  private base64urlDecode(str: string): string {
    try {
      const pad = str.length % 4 === 2 ? '==' : str.length % 4 === 3 ? '=' : ''
      const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad
      return atob(b64)
    } catch {
      return ''
    }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): AuthConfig {
    return { ...this.config }
  }
}

/**
 * 默认认证服务实例
 */
export const authService = new AuthService()

/**
 * 便捷函数（保持向后兼容）
 */
export async function getEntitlement(
  preferNetwork: boolean = true
): Promise<EntitlementResult> {
  const result = await authService.getEntitlement(preferNetwork)
  if (result.ok) {
    return result.value
  }
  throw result.error
}

export async function isPro(preferNetwork: boolean = false): Promise<boolean> {
  const result = await authService.isPro(preferNetwork)
  if (result.ok) {
    return result.value
  }
  return false
}

export async function getToken(): Promise<string | null> {
  const result = await authService.getToken()
  if (result.ok) {
    return result.value
  }
  return null
}

export async function setToken(token: string): Promise<void> {
  const result = await authService.setToken(token)
  if (!result.ok) {
    throw result.error
  }
}

export async function clearToken(): Promise<void> {
  const result = await authService.clearToken()
  if (!result.ok) {
    throw result.error
  }
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await authService.getRefreshToken()
  if (result.ok) {
    return result.value
  }
  return null
}

export async function setRefreshToken(token: string): Promise<void> {
  const result = await authService.setRefreshToken(token)
  if (!result.ok) {
    throw result.error
  }
}

export async function clearRefreshToken(): Promise<void> {
  const result = await authService.clearRefreshToken()
  if (!result.ok) {
    throw result.error
  }
}

export async function saveAuthTokens(
  accessToken: string,
  refreshToken?: string | null
): Promise<void> {
  const result = await authService.saveAuthTokens(accessToken, refreshToken)
  if (!result.ok) {
    throw result.error
  }
}

export async function ensureFreshTokenSafely(): Promise<void> {
  const result = await authService.ensureFreshTokenSafely()
  if (!result.ok) {
    throw result.error
  }
}

export function computeEntitlementFromToken(
  token: string | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
  graceSec = 3 * 24 * 60 * 60
): EntitlementResult {
  return authService.computeEntitlementFromToken(token, nowSec, graceSec)
}
