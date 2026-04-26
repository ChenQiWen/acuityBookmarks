/**
 * Supabase 认证状态管理 Composable
 *
 * 职责：
 * - 读取和管理 Supabase 认证状态
 * - 监听认证状态变化
 * - 提供登出功能
 * - 检测用户不活跃超时（30 天）
 * 
 * 注意：
 * - 登录功能已迁移到官网，插件只负责状态同步
 * - 用户在官网登录后，插件会自动同步 session
 * 
 * 安全策略：
 * - Access Token 过期时间：1 小时
 * - Refresh Token 过期时间：60 天（需在 Supabase Dashboard 配置）
 * - 不活跃超时：30 天（本地检测）
 */

import { ref, computed, onMounted } from 'vue'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { logger } from '@/infrastructure/logging/logger'
import { modernStorage } from '@/infrastructure/storage/modern-storage'

/**
 * 不活跃超时时间：30 天（毫秒）
 * 如果用户 30 天内未使用应用，将自动登出
 */
const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000

/**
 * 本地存储 key
 */
const STORAGE_KEYS = {
  LAST_ACTIVITY: 'auth_last_activity',
  DEVICE_FINGERPRINT: 'auth_device_fingerprint'
} as const

/**
 * 认证状态
 */
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Supabase 认证状态管理 Composable
 */
export function useSupabaseAuth() {
  /**
   * 检查用户不活跃超时
   * 如果用户超过 30 天未使用应用，自动登出
   */
  const checkInactivity = async () => {
    if (!isSupabaseConfigured() || !user.value) {
      return
    }

    try {
      const lastActivity = await modernStorage.getLocal<number>(
        STORAGE_KEYS.LAST_ACTIVITY
      )
      const now = Date.now()

      if (lastActivity && now - lastActivity > INACTIVITY_TIMEOUT) {
        logger.warn(
          '[useSupabaseAuth] 🔒 用户超过 30 天未活跃，自动登出',
          {
            lastActivity: new Date(lastActivity).toISOString(),
            daysSinceLastActivity: Math.floor(
              (now - lastActivity) / (24 * 60 * 60 * 1000)
            )
          }
        )

        await signOut()
        error.value = '您已超过 30 天未使用，为了安全已自动登出，请重新登录'
      } else {
        // 更新最后活跃时间
        await updateActivity()
      }
    } catch (err) {
      logger.error('[useSupabaseAuth] 检查不活跃超时失败:', err)
    }
  }

  /**
   * 更新用户最后活跃时间
   */
  const updateActivity = async () => {
    if (!isSupabaseConfigured() || !user.value) {
      return
    }

    try {
      await modernStorage.setLocal(STORAGE_KEYS.LAST_ACTIVITY, Date.now())
      logger.debug('[useSupabaseAuth] ✅ 已更新最后活跃时间')
    } catch (err) {
      logger.error('[useSupabaseAuth] 更新活跃时间失败:', err)
    }
  }

  /**
   * 初始化：检查当前 session
   */
  const initialize = async () => {
    if (!isSupabaseConfigured()) {
      loading.value = false
      error.value = 'Supabase 未配置'
      return
    }

    try {
      loading.value = true
      logger.debug('[useSupabaseAuth] 开始初始化，检查 session...')

      const {
        data: { session: currentSession },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        logger.error('[useSupabaseAuth] 获取 session 失败:', sessionError)
        throw sessionError
      }

      logger.debug('[useSupabaseAuth] Session 获取成功:', {
        hasSession: !!currentSession,
        userId: currentSession?.user?.id,
        email: currentSession?.user?.email
      })

      session.value = currentSession
      user.value = currentSession?.user ?? null

      // 🔒 检查不活跃超时
      if (user.value) {
        await checkInactivity()
      }

      logger.debug('[useSupabaseAuth] 初始化完成，登录状态:', !!user.value)
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '获取 session 失败'
      logger.error('[useSupabaseAuth] 初始化失败:', authError)
      session.value = null
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * 登出
   */
  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      return
    }

    try {
      loading.value = true
      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        throw signOutError
      }

      user.value = null
      session.value = null

      // 🧹 清除本地活跃时间记录
      await modernStorage.removeLocal(STORAGE_KEYS.LAST_ACTIVITY)

      logger.debug('[useSupabaseAuth] ✅ 登出成功')
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '登出失败'
      logger.error('[useSupabaseAuth] 登出失败:', authError)
      throw authError
    } finally {
      loading.value = false
    }
  }

  /**
   * 监听认证状态变化
   */
  let authStateSubscription: ReturnType<
    typeof supabase.auth.onAuthStateChange
  > | null = null

  const setupAuthListener = () => {
    if (authStateSubscription) {
      return // 已设置，避免重复订阅
    }

    authStateSubscription = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        logger.debug('[useSupabaseAuth] 认证状态变化:', event, {
          hasSession: !!newSession,
          userId: newSession?.user?.id
        })

        session.value = newSession
        user.value = newSession?.user ?? null

        // 🔑 当用户登出或 session 失效时，清除本地存储
        if (event === 'SIGNED_OUT' || !newSession) {
          logger.debug('[useSupabaseAuth] 🧹 清除本地用户数据...')
          try {
            const { modernStorage } = await import(
              '@/infrastructure/storage/modern-storage'
            )
            await modernStorage.removeLocal('current_login_provider')
            await modernStorage.removeLocal(STORAGE_KEYS.LAST_ACTIVITY)
            logger.debug('[useSupabaseAuth] ✅ 已清除本地用户数据')
          } catch (err) {
            logger.error('[useSupabaseAuth] ❌ 清除本地数据失败:', err)
          }
        }

        // 🔒 当用户登录或 session 刷新时，更新活跃时间
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await updateActivity()
        }
      }
    )
  }

  /**
   * 取消订阅
   */
  const unsubscribe = () => {
    if (authStateSubscription) {
      authStateSubscription.data.subscription.unsubscribe()
      authStateSubscription = null
    }
  }

  // 初始化
  onMounted(() => {
    initialize().then(() => {
      setupAuthListener()
    })

    // 监听来自 background 的认证状态变化通知
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'session' && changes.__authStateChanged) {
        logger.info('[useSupabaseAuth] 🔔 收到认证状态变化通知，刷新 session...')
        initialize()
      }
    })
  })

  return {
    // 状态
    user: computed(() => user.value),
    session: computed(() => session.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isAuthenticated: computed(() => !!user.value),

    // 方法
    signOut,
    initialize,
    unsubscribe,
    updateActivity, // 暴露给外部调用，用于更新活跃时间
    checkInactivity // 暴露给外部调用，用于手动检查
  }
}
