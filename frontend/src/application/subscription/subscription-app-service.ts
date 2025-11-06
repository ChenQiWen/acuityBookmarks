/**
 * 订阅应用服务
 *
 * 职责：
 * - 管理用户订阅状态
 * - 处理订阅创建、更新、取消
 * - 与 Supabase（通过 API）和 Lemon Squeezy 集成
 */

import {
  createCheckout,
  getSubscriptionStatus
} from '@/infrastructure/lemon-squeezy/client'
import { API_CONFIG } from '@/config/constants'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'
import type {
  Subscription,
  UserSubscriptionStatus
} from '@/infrastructure/supabase/types'
import { notificationService } from '@/application/notification/notification-service'

/**
 * 订阅应用服务类
 */
export class SubscriptionAppService {
  /**
   * 获取用户当前订阅状态
   *
   * @param userId - Supabase 用户 ID
   * @returns 订阅状态
   */
  async getUserSubscription(
    userId: string
  ): Promise<UserSubscriptionStatus | null> {
    try {
      const subscription = await getSubscriptionStatus(userId)

      if (!subscription) {
        return {
          tier: 'free',
          status: 'expired',
          current_period_end: new Date().toISOString(),
          cancel_at_period_end: false
        }
      }

      return {
        tier: subscription.tier,
        status: subscription.status as UserSubscriptionStatus['status'],
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end
      }
    } catch (error) {
      console.error('[SubscriptionAppService] 获取订阅状态异常:', error)
      return {
        tier: 'free',
        status: 'expired',
        current_period_end: new Date().toISOString(),
        cancel_at_period_end: false
      }
    }
  }

  /**
   * 获取用户订阅详情
   *
   * @param userId - Supabase 用户 ID
   * @returns 订阅详情
   */
  async getSubscriptionDetails(userId: string): Promise<Subscription | null> {
    try {
      const subscription = await getSubscriptionStatus(userId)

      if (!subscription || !subscription.id) {
        return null
      }

      // 转换为 Subscription 类型（简化版，因为 API 只返回部分字段）
      return {
        id: subscription.id,
        user_id: userId,
        lemon_squeezy_subscription_id: subscription.id,
        lemon_squeezy_order_id: null,
        lemon_squeezy_variant_id: null,
        status: subscription.status as Subscription['status'],
        tier: subscription.tier,
        current_period_start: new Date().toISOString(),
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancelled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('[SubscriptionAppService] 获取订阅详情异常:', error)
      return null
    }
  }

  /**
   * 创建支付链接
   *
   * @param variantId - Lemon Squeezy 产品变体 ID
   * @param userId - Supabase 用户 ID
   * @param email - 用户邮箱
   * @returns 支付链接
   */
  async createCheckoutLink(
    variantId: string,
    userId: string,
    email: string
  ): Promise<string> {
    try {
      const checkoutUrl = await createCheckout(variantId, userId, email)
      return checkoutUrl
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '创建支付链接失败'
      console.error('[SubscriptionAppService] 创建支付链接失败:', error)
      throw new Error(errorMessage)
    }
  }

  /**
   * 取消订阅（在周期结束时取消）
   *
   * @param subscriptionId - 订阅 ID
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      const apiBase = API_CONFIG.API_BASE
      const url = `${apiBase}/api/lemon-squeezy/subscription/cancel`

      const response = await safeJsonFetch<{
        success: boolean
        error?: string
      }>(url, 5000, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription_id: subscriptionId })
      })

      if (!response || !response.success) {
        throw new Error(response?.error || '取消订阅失败')
      }

      notificationService.notify('订阅将在当前周期结束时取消', {
        level: 'success'
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '取消订阅失败'
      console.error('[SubscriptionAppService] 取消订阅异常:', error)
      throw new Error(errorMessage)
    }
  }

  /**
   * 恢复订阅
   *
   * @param subscriptionId - 订阅 ID
   */
  async resumeSubscription(subscriptionId: string): Promise<void> {
    try {
      const apiBase = API_CONFIG.API_BASE
      const url = `${apiBase}/api/lemon-squeezy/subscription/resume`

      const response = await safeJsonFetch<{
        success: boolean
        error?: string
      }>(url, 5000, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription_id: subscriptionId })
      })

      if (!response || !response.success) {
        throw new Error(response?.error || '恢复订阅失败')
      }

      notificationService.notify('订阅已恢复', { level: 'success' })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '恢复订阅失败'
      console.error('[SubscriptionAppService] 恢复订阅异常:', error)
      throw new Error(errorMessage)
    }
  }

  /**
   * 检查用户是否为 Pro 用户
   *
   * @param userId - Supabase 用户 ID
   * @returns 是否为 Pro 用户
   */
  async isProUser(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId)
    return subscription?.tier === 'pro' && subscription?.status === 'active'
  }
}

/**
 * 默认订阅应用服务实例
 */
export const subscriptionAppService = new SubscriptionAppService()
