/**
 * Supabase 认证状态管理 Composable
 *
 * 职责：
 * - 读取和管理 Supabase 认证状态
 * - 监听认证状态变化
 * - 提供登出功能
 * 
 * 注意：
 * - 登录功能已迁移到官网，插件只负责状态同步
 * - 用户在官网登录后，插件会自动同步 session
 */

import { ref, computed, onMounted } from 'vue'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { logger } from '@/infrastructure/logging/logger'

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
            logger.debug('[useSupabaseAuth] ✅ 已清除本地用户数据')
          } catch (err) {
            logger.error('[useSupabaseAuth] ❌ 清除本地数据失败:', err)
          }
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
    unsubscribe
  }
}
