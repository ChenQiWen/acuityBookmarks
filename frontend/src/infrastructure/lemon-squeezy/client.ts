/**
 * Lemon Squeezy 客户端
 *
 * 职责：
 * - 创建支付链接
 * - 处理支付回调
 * - 查询订阅状态
 */

import { API_CONFIG } from '@/config/constants'
import { safeJsonFetch } from '@/infrastructure/http/safe-fetch'

/**
 * Lemon Squeezy 产品变体 ID
 * 需要在 Lemon Squeezy Dashboard 中创建产品后获取
 */
export const LEMON_SQUEEZY_VARIANT_IDS = {
  PRO_MONTHLY: import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID_MONTHLY || '',
  PRO_YEARLY: import.meta.env.VITE_LEMON_SQUEEZY_VARIANT_ID_YEARLY || ''
} as const

/**
 * 创建支付链接请求
 */
export interface CreateCheckoutRequest {
  variant_id: string
  user_id: string
  email: string
}

/**
 * 创建支付链接响应
 */
export interface CreateCheckoutResponse {
  success: boolean
  checkout_url?: string
  error?: string
}

/**
 * 创建支付链接
 *
 * @param variantId - Lemon Squeezy 产品变体 ID
 * @param userId - Supabase 用户 ID
 * @param email - 用户邮箱
 * @returns 支付链接
 */
export async function createCheckout(
  variantId: string,
  userId: string,
  email: string
): Promise<string> {
  const apiBase = API_CONFIG.API_BASE
  const url = `${apiBase}/api/lemon-squeezy/checkout`

  const response = await safeJsonFetch<CreateCheckoutResponse>(
    url,
    10000, // 10秒超时
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        variant_id: variantId,
        user_id: userId,
        email
      } satisfies CreateCheckoutRequest)
    }
  )

  if (!response || !response.success || !response.checkout_url) {
    throw new Error(response?.error || '创建支付链接失败')
  }

  return response.checkout_url
}

/**
 * 查询订阅状态
 */
export interface SubscriptionStatusResponse {
  success: boolean
  subscription?: {
    id: string
    status: string
    tier: 'free' | 'pro'
    current_period_end: string
    cancel_at_period_end: boolean
  }
  error?: string
}

/**
 * 查询用户订阅状态
 *
 * @param userId - Supabase 用户 ID
 * @returns 订阅状态
 */
export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatusResponse['subscription']> {
  const apiBase = API_CONFIG.API_BASE
  const url = `${apiBase}/api/lemon-squeezy/subscription?user_id=${encodeURIComponent(userId)}`

  const response = await safeJsonFetch<SubscriptionStatusResponse>(
    url,
    5000, // 5秒超时
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response || !response.success) {
    throw new Error(response?.error || '查询订阅状态失败')
  }

  return response.subscription || undefined
}
