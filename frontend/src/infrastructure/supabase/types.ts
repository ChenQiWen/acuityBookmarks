/**
 * Supabase 数据库类型定义
 *
 * 这些类型对应 Supabase 数据库中的表结构
 */

/**
 * 用户资料
 */
export interface UserProfile {
  id: string
  email: string
  nickname: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

/**
 * 订阅状态
 */
export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'past_due'
  | 'paused'

/**
 * 订阅信息
 */
export interface Subscription {
  id: string
  user_id: string
  lemon_squeezy_subscription_id: string
  lemon_squeezy_order_id: string | null
  lemon_squeezy_variant_id: string | null
  status: SubscriptionStatus
  tier: 'free' | 'pro'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

/**
 * 支付记录状态
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

/**
 * 支付记录
 */
export interface PaymentRecord {
  id: string
  user_id: string
  subscription_id: string | null
  lemon_squeezy_order_id: string
  lemon_squeezy_payment_id: string | null
  amount: number // 金额（分）
  currency: string
  status: PaymentStatus
  payment_method: string | null
  event_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

/**
 * 用户订阅状态查询结果
 */
export interface UserSubscriptionStatus {
  tier: 'free' | 'pro'
  status: SubscriptionStatus
  current_period_end: string
  cancel_at_period_end: boolean
}
