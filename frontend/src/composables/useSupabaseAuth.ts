/**
 * Supabase 认证 Composable（仅 OAuth）
 *
 * 职责：
 * - 封装 Supabase OAuth 认证（Google、Microsoft）
 * - 提供统一的认证接口
 * - 处理认证状态管理
 * 
 * 注意：本项目仅支持 OAuth 登录，不支持邮箱密码登录
 * 这样可以提供更好的安全性和用户体验
 */

import { ref, computed, onMounted } from 'vue'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'
import type { User, Session, AuthError } from '@supabase/supabase-js'
// 🔑 导入 OAuth 实现
import { signInWithOAuthNew } from './useSupabaseAuth-oauth-new'

/**
 * 认证状态
 */
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Supabase 认证 Composable（仅 OAuth）
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
      console.log('[useSupabaseAuth] 开始初始化，检查 session...')
      
      const {
        data: { session: currentSession },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[useSupabaseAuth] 获取 session 失败:', sessionError)
        throw sessionError
      }

      console.log('[useSupabaseAuth] Session 获取成功:', {
        hasSession: !!currentSession,
        userId: currentSession?.user?.id,
        email: currentSession?.user?.email
      })

      session.value = currentSession
      user.value = currentSession?.user ?? null

      console.log('[useSupabaseAuth] 初始化完成，登录状态:', !!user.value)
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '获取 session 失败'
      console.error('[useSupabaseAuth] 初始化失败:', authError)
      session.value = null
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * OAuth 登录（Google、Microsoft）
   * 
   * @param provider - OAuth 提供商：'google' 或 'microsoft'
   * @returns Promise<{ success: boolean }>
   */
  const signInWithOAuth = async (
    provider: 'google' | 'microsoft'
  ): Promise<{ success: boolean }> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    try {
      loading.value = true
      error.value = null

      console.log('[useSupabaseAuth] 开始 OAuth 登录:', provider)
      
      // 使用新的 OAuth 实现（支持 Google 和 Microsoft）
      await signInWithOAuthNew(provider)
      
      console.log('[useSupabaseAuth] OAuth 登录成功')

      // 等待用户信息同步
      await new Promise(resolve => setTimeout(resolve, 500))

      // 刷新用户信息，确保获取到完整的 user_metadata（昵称、头像等）
      try {
        const {
          data: { user: refreshedUser },
          error: refreshError
        } = await supabase.auth.getUser()
        
        if (refreshError) {
          console.warn('[useSupabaseAuth] ⚠️ 刷新用户信息失败:', refreshError)
        } else if (refreshedUser) {
          console.log('[useSupabaseAuth] ✅ 用户信息已刷新:', {
            userId: refreshedUser.id,
            email: refreshedUser.email,
            hasFullName: !!refreshedUser.user_metadata?.full_name,
            hasPicture: !!refreshedUser.user_metadata?.picture
          })
          user.value = refreshedUser
        }
      } catch (refreshErr) {
        console.warn('[useSupabaseAuth] ⚠️ 刷新用户信息异常:', refreshErr)
      }

      return { success: true }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'OAuth 登录失败'
      console.error('[useSupabaseAuth] OAuth 登录失败:', authError)
      throw authError
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
      
      console.log('[useSupabaseAuth] ✅ 登出成功')
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '登出失败'
      console.error('[useSupabaseAuth] 登出失败:', authError)
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
        console.log('[useSupabaseAuth] 认证状态变化:', event, {
          hasSession: !!newSession,
          userId: newSession?.user?.id
        })

        session.value = newSession
        user.value = newSession?.user ?? null

        // 🔑 当用户登出或 session 失效时，清除本地存储
        if (event === 'SIGNED_OUT' || !newSession) {
          console.log('[useSupabaseAuth] 🧹 清除本地用户数据...')
          try {
            const { modernStorage } = await import(
              '@/infrastructure/storage/modern-storage'
            )
            await modernStorage.removeLocal('current_login_provider')
            console.log('[useSupabaseAuth] ✅ 已清除本地用户数据')
          } catch (err) {
            console.error('[useSupabaseAuth] ❌ 清除本地数据失败:', err)
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
  })

  return {
    // 状态
    user: computed(() => user.value),
    session: computed(() => session.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isAuthenticated: computed(() => !!user.value),

    // 方法
    signInWithOAuth,
    signInWithOAuthNew, // 🔑 导出新的 OAuth 实现（兼容性）
    signOut,
    initialize,
    unsubscribe
  }
}
