/**
 * 订阅管理 Composable
 *
 * 职责：
 * - 管理订阅状态
 * - 提供订阅操作接口
 * - 与 UI 组件集成
 */

import { ref, computed, onMounted } from 'vue'
import { subscriptionAppService } from '@/application/subscription/subscription-app-service'
import { useSupabaseAuth } from './useSupabaseAuth'
import type {
  Subscription,
  UserSubscriptionStatus
} from '@/infrastructure/supabase/types'
import { LEMON_SQUEEZY_VARIANT_IDS } from '@/infrastructure/lemon-squeezy/client'

/**
 * 订阅管理 Composable
 */
export function useSubscription() {
  const { user, isAuthenticated } = useSupabaseAuth()

  const subscription = ref<Subscription | null>(null)
  const subscriptionStatus = ref<UserSubscriptionStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * 错误消息（用于显示）
   */
  const errorMessage = computed(() => error.value)

  /**
   * 是否为 Pro 用户
   */
  const isPro = computed(() => {
    return (
      subscriptionStatus.value?.tier === 'pro' &&
      subscriptionStatus.value?.status === 'active'
    )
  })

  /**
   * 订阅是否即将到期
   */
  const isExpiringSoon = computed(() => {
    if (!subscriptionStatus.value?.current_period_end) {
      return false
    }
    const endDate = new Date(subscriptionStatus.value.current_period_end)
    const daysUntilExpiry =
      (endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  })

  /**
   * 订阅是否已取消但仍在有效期内
   */
  const isCancelledButActive = computed(() => {
    return (
      subscriptionStatus.value?.cancel_at_period_end === true &&
      subscriptionStatus.value?.status === 'active'
    )
  })

  /**
   * 加载订阅状态
   */
  const loadSubscription = async () => {
    if (!isAuthenticated.value || !user.value) {
      subscription.value = null
      subscriptionStatus.value = null
      return
    }

    try {
      loading.value = true
      error.value = null

      const [details, status] = await Promise.all([
        subscriptionAppService.getSubscriptionDetails(user.value.id),
        subscriptionAppService.getUserSubscription(user.value.id)
      ])

      subscription.value = details
      subscriptionStatus.value = status
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '加载订阅状态失败'
      error.value = errorMessage
      console.error('[useSubscription] 加载订阅状态失败:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建支付链接并跳转
   *
   * @param variantId - Lemon Squeezy 产品变体 ID
   */
  const checkout = async (variantId: string) => {
    if (!isAuthenticated.value || !user.value) {
      throw new Error('请先登录')
    }

    try {
      loading.value = true
      error.value = null

      const checkoutUrl = await subscriptionAppService.createCheckoutLink(
        variantId,
        user.value.id,
        user.value.email || ''
      )

      // 在新标签页打开支付链接
      window.open(checkoutUrl, '_blank')
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '创建支付链接失败'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  /**
   * 取消订阅
   */
  const cancel = async () => {
    if (!subscription.value) {
      throw new Error('没有活跃的订阅')
    }

    try {
      loading.value = true
      error.value = null

      await subscriptionAppService.cancelSubscription(subscription.value.id)
      await loadSubscription() // 重新加载状态
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取消订阅失败'
      error.value = errorMessage
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 恢复订阅
   */
  const resume = async () => {
    if (!subscription.value) {
      throw new Error('没有活跃的订阅')
    }

    try {
      loading.value = true
      error.value = null

      await subscriptionAppService.resumeSubscription(subscription.value.id)
      await loadSubscription() // 重新加载状态
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '恢复订阅失败'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  /**
   * 便捷方法：订阅月度 Pro
   */
  const subscribeMonthly = () => {
    return checkout(LEMON_SQUEEZY_VARIANT_IDS.PRO_MONTHLY)
  }

  /**
   * 便捷方法：订阅年度 Pro
   */
  const subscribeYearly = () => {
    return checkout(LEMON_SQUEEZY_VARIANT_IDS.PRO_YEARLY)
  }

  // 初始化时加载订阅状态
  onMounted(() => {
    if (isAuthenticated.value) {
      loadSubscription()
    }
  })

  return {
    // 状态
    subscription: computed(() => subscription.value),
    subscriptionStatus: computed(() => subscriptionStatus.value),
    loading: computed(() => loading.value),
    error: errorMessage,
    isPro,
    isExpiringSoon,
    isCancelledButActive,

    // 方法
    loadSubscription,
    checkout,
    cancel,
    resume,
    subscribeMonthly,
    subscribeYearly
  }
}
