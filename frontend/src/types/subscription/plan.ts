/**
 * 订阅计划类型定义
 *
 * Plan（计划/套餐）：产品提供的订阅套餐定义
 * Subscription（订阅）：用户当前的订阅实例
 */

import { GUMROAD_CONFIG } from '@/infrastructure/gumroad/client'

/**
 * 计划层级
 */
export type PlanTier = 'free' | 'pro'

/**
 * 计费周期
 */
export type BillingPeriod = 'monthly' | 'yearly'

/**
 * 计划价格
 */
export interface PlanPrice {
  monthly: number // 月付价格（分）
  yearly: number // 年付价格（分）
  currency: string // 货币代码（如 'USD', 'CNY'）
}

/**
 * 计划功能列表
 */
export interface PlanFeature {
  id: string
  name: string
  description?: string
  enabled: boolean
}

/**
 * 订阅计划定义
 */
export interface Plan {
  id: string
  name: string // 显示名称（如 "Free", "Pro"）
  tier: PlanTier
  description: string // 计划描述
  price: PlanPrice
  features: PlanFeature[]
  gumroadPlanId: {
    monthly: string
    yearly: string
  }
  popular?: boolean // 是否推荐
  badge?: string // 徽章文字（如 "推荐", "最受欢迎"）
}

/**
 * 所有可用计划
 */
export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    description: '免费计划，适合个人用户',
    price: {
      monthly: 0,
      yearly: 0,
      currency: 'USD'
    },
    features: [
      {
        id: 'bookmarks',
        name: '书签管理',
        description: '基础书签管理功能',
        enabled: true
      },
      {
        id: 'sync',
        name: '同步',
        description: '跨设备同步',
        enabled: true
      },
      {
        id: 'ai_tags',
        name: 'AI 标签',
        description: 'AI 自动生成标签',
        enabled: false
      },
      {
        id: 'vector_search',
        name: '向量检索',
        description: '语义搜索',
        enabled: false
      }
    ],
    gumroadPlanId: {
      monthly: '',
      yearly: ''
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    tier: 'pro',
    description: '专业计划，解锁所有功能',
    price: {
      monthly: 100, // $1.00/月（测试价格，以分为单位）
      yearly: 1200, // $12.00/年（测试价格，以分为单位）
      currency: 'USD'
    },
    features: [
      {
        id: 'bookmarks',
        name: '书签管理',
        description: '基础书签管理功能',
        enabled: true
      },
      {
        id: 'sync',
        name: '同步',
        description: '跨设备同步',
        enabled: true
      },
      {
        id: 'ai_tags',
        name: 'AI 标签',
        description: 'AI 自动生成标签',
        enabled: true
      },
      {
        id: 'vector_search',
        name: '向量检索',
        description: '语义搜索',
        enabled: true
      }
    ],
    gumroadPlanId: {
      monthly: GUMROAD_CONFIG.planIds.PRO_MONTHLY,
      yearly: GUMROAD_CONFIG.planIds.PRO_YEARLY
    },
    popular: true,
    badge: '推荐'
  }
] as const

/**
 * 根据 ID 获取计划
 */
export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find(plan => plan.id === planId)
}

/**
 * 根据 tier 获取计划
 */
export function getPlanByTier(tier: PlanTier): Plan | undefined {
  return PLANS.find(plan => plan.tier === tier)
}

/**
 * 格式化价格显示
 */
export function formatPrice(
  price: number,
  currency: string = 'USD',
  period: BillingPeriod = 'monthly'
): string {
  const amount = price / 100 // 转换为元/美元
  const symbol = currency === 'USD' ? '$' : '¥'
  const periodText = period === 'monthly' ? '月' : '年'

  return `${symbol}${amount.toFixed(2)}/${periodText}`
}

/**
 * 计算年付折扣
 */
export function calculateYearlyDiscount(
  monthlyPrice: number,
  yearlyPrice: number
): number {
  const monthlyTotal = monthlyPrice * 12
  if (monthlyTotal === 0) return 0
  return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100)
}
