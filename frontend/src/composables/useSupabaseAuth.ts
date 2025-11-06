/**
 * Supabase 认证 Composable
 *
 * 职责：
 * - 封装 Supabase Auth 的使用
 * - 提供统一的认证接口
 * - 处理认证状态管理
 * - 与现有账号系统集成
 */

import { ref, computed, onMounted } from 'vue'
import {
  supabase,
  isSupabaseConfigured
} from '@/infrastructure/supabase/client'
import {
  getErrorMessage,
  extractErrorCode
} from '@/infrastructure/http/error-codes'
import type { User, Session, AuthError } from '@supabase/supabase-js'

/**
 * 邮箱格式验证
 */
const isEmailValid = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * 认证状态
 */
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Supabase 认证 Composable
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
   * 邮箱密码注册
   */
  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    try {
      loading.value = true
      error.value = null

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // 禁用邮件发送（邮箱验证已在 Dashboard 中禁用）
          // 明确告诉 Supabase 不要发送任何邮件，避免触发频率限制
          emailRedirectTo: chrome.runtime.getURL('auth.html'),
          // 不发送确认邮件（邮箱验证已禁用）
          // 注意：即使邮箱验证禁用，Supabase 可能仍会发送欢迎邮件
          // 如果遇到频率限制错误，说明 Supabase 仍在尝试发送邮件
          data: {
            // 可以在这里添加额外的用户元数据，但不影响邮件发送
          }
        }
      })

      if (signUpError) {
        // 提取错误码和消息
        const errorCode = extractErrorCode(signUpError)?.toLowerCase() || ''
        const errorMessage = signUpError.message?.toLowerCase() || ''

        console.log('[useSupabaseAuth] 注册错误:', {
          errorCode,
          errorMessage,
          fullError: signUpError
        })

        // 优先检查专门的"邮箱已注册"错误码（Supabase 官方错误码）
        if (
          errorCode === 'email_already_registered' ||
          errorCode === 'email_exists' ||
          errorCode.includes('already_registered') ||
          errorCode.includes('email_exists') ||
          errorMessage.includes('already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('user already registered')
        ) {
          console.log('[useSupabaseAuth] ✅ 检测到邮箱已注册')
          throw new Error('该邮箱已被注册，请直接登录或使用其他邮箱')
        }

        // 检查邮件发送频率限制（不应误判为已注册）
        if (
          errorCode === 'over_email_send_rate_limit' ||
          errorCode === 'email_rate_limit_exceeded' ||
          errorCode.includes('rate_limit') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('rate_limit')
        ) {
          console.log('[useSupabaseAuth] ⚠️ 检测到邮件发送频率限制')
          // 使用标准错误码映射，会显示"发送邮件过于频繁"
          const friendlyMessage = getErrorMessage(
            errorCode,
            '发送邮件过于频繁，请稍后再试'
          )
          throw new Error(friendlyMessage)
        }

        // 特殊情况：Supabase 在某些情况下（如邮箱验证关闭时）会对已注册邮箱返回 email_address_invalid
        // 如果邮箱格式正确，但返回 email_address_invalid，很可能是已注册
        if (errorCode === 'email_address_invalid' && isEmailValid(email)) {
          // 邮箱格式正确，但 Supabase 认为无效
          // 根据 Supabase 的行为，这种情况通常是邮箱已注册
          console.log(
            '[useSupabaseAuth] ⚠️ 检测到邮箱格式正确但返回 invalid，可能是已注册'
          )
          throw new Error('该邮箱可能已被注册，请尝试登录或使用其他邮箱')
        }

        // 其他情况：使用标准错误码映射
        const friendlyMessage = getErrorMessage(
          errorCode || signUpError.code || signUpError.status?.toString(),
          '注册失败，请稍后重试'
        )

        console.log('[useSupabaseAuth] 使用通用错误映射:', friendlyMessage)
        throw new Error(friendlyMessage)
      }

      // 注册成功，设置用户和会话
      if (data.user) {
        user.value = data.user
        session.value = data.session
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (err) {
      const authError = err as AuthError

      // 如果错误消息包含"已被注册"或"already registered"，直接使用
      if (
        err instanceof Error &&
        (err.message.includes('已被注册') ||
          err.message.includes('already registered') ||
          err.message.includes('already exists'))
      ) {
        error.value = err.message
        throw err
      }

      // 提取错误码并映射为用户友好的文案
      const errorCode = extractErrorCode(authError)
      error.value = getErrorMessage(
        errorCode || authError.code || authError.status?.toString(),
        '注册失败，请稍后重试'
      )
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 邮箱密码登录
   */
  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    try {
      loading.value = true
      error.value = null

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password
        })

      if (signInError) {
        // 提取错误码并映射为用户友好的文案
        const errorCode = extractErrorCode(signInError)
        const friendlyMessage = getErrorMessage(
          errorCode || signInError.code || signInError.status?.toString(),
          '登录失败，请稍后重试'
        )

        const customError = new Error(friendlyMessage) as AuthError
        customError.status = signInError.status
        customError.code = signInError.code
        throw customError
      }

      user.value = data.user
      session.value = data.session

      return {
        success: true,
        user: data.user,
        session: data.session
      }
    } catch (err) {
      const authError = err as AuthError
      // 提取错误码并映射为用户友好的文案
      const errorCode = extractErrorCode(authError)
      error.value = getErrorMessage(
        errorCode || authError.code || authError.status?.toString(),
        '登录失败，请稍后重试'
      )
      throw authError
    } finally {
      loading.value = false
    }
  }

  /**
   * 社交登录（OAuth）
   *
   * Chrome Extension 环境下的 OAuth 流程：
   * 1. 调用 Supabase OAuth API 获取授权 URL
   * 2. 使用 chrome.identity.launchWebAuthFlow 打开授权页面
   * 3. 用户授权后，Supabase 会重定向到 redirectTo URL
   * 4. 从重定向 URL 中提取 token 并设置 session
   */
  const signInWithOAuth = async (
    provider: 'google' | 'github'
  ): Promise<{ success: boolean; url?: string }> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    // Chrome Extension 环境检查
    if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
      throw new Error('当前环境不支持 OAuth 登录')
    }

    return new Promise((resolve, reject) => {
      supabase.auth
        .signInWithOAuth({
          provider,
          options: {
            redirectTo: chrome.runtime.getURL('auth.html'),
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            }
          }
        })
        .then(({ data, error: oauthError }) => {
          if (oauthError) {
            loading.value = false
            error.value = oauthError.message || 'OAuth 登录失败'
            reject(oauthError)
            return
          }

          if (!data.url) {
            loading.value = false
            error.value = '未获取到授权 URL'
            reject(new Error('未获取到授权 URL'))
            return
          }

          // Chrome Extension 环境下使用 chrome.identity API
          chrome.identity.launchWebAuthFlow(
            {
              url: data.url,
              interactive: true
            },
            async redirectUrl => {
              loading.value = false

              if (chrome.runtime.lastError) {
                error.value =
                  chrome.runtime.lastError.message || 'OAuth 登录失败'
                reject(
                  new Error(
                    chrome.runtime.lastError.message || 'OAuth 登录失败'
                  )
                )
                return
              }

              if (!redirectUrl) {
                error.value = '未获取到重定向 URL'
                reject(new Error('未获取到重定向 URL'))
                return
              }

              try {
                // 从重定向 URL 中提取 token
                const url = new URL(redirectUrl)
                const hash = url.hash.substring(1)
                const params = new URLSearchParams(hash)

                const accessToken = params.get('access_token')
                const refreshToken = params.get('refresh_token')

                if (accessToken && refreshToken) {
                  const { data: sessionData, error: sessionError } =
                    await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken
                    })

                  if (sessionError) {
                    error.value = sessionError.message || '设置 session 失败'
                    reject(sessionError)
                  } else {
                    user.value = sessionData.user
                    session.value = sessionData.session
                    resolve({ success: true })
                  }
                } else {
                  error.value = '未从重定向 URL 中获取到 token'
                  reject(new Error('未从重定向 URL 中获取到 token'))
                }
              } catch (err) {
                const authError = err as AuthError
                error.value = authError.message || '处理 OAuth 回调失败'
                reject(authError)
              }
            }
          )
        })
        .catch(err => {
          loading.value = false
          error.value = err.message || 'OAuth 登录失败'
          reject(err)
        })
    })
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
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '登出失败'
      throw authError
    } finally {
      loading.value = false
    }
  }

  /**
   * 发送密码重置邮件
   */
  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    try {
      loading.value = true
      error.value = null

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: chrome.runtime.getURL('auth.html?reset=true')
        }
      )

      if (resetError) {
        // 提取错误码并映射为用户友好的文案
        const errorCode = extractErrorCode(resetError)
        throw new Error(
          getErrorMessage(
            errorCode || resetError.code || resetError.status?.toString(),
            '发送重置邮件失败，请稍后重试'
          )
        )
      }

      return { success: true }
    } catch (err) {
      const authError = err as AuthError
      // 提取错误码并映射为用户友好的文案
      const errorCode = extractErrorCode(authError)
      error.value = getErrorMessage(
        errorCode || authError.code || authError.status?.toString(),
        '发送重置邮件失败，请稍后重试'
      )
      throw authError
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新密码
   */
  const updatePassword = async (newPassword: string) => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    try {
      loading.value = true
      error.value = null

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        // 提取错误码并映射为用户友好的文案
        const errorCode = extractErrorCode(updateError)
        throw new Error(
          getErrorMessage(
            errorCode || updateError.code || updateError.status?.toString(),
            '更新密码失败，请稍后重试'
          )
        )
      }

      return { success: true }
    } catch (err) {
      const authError = err as AuthError
      // 提取错误码并映射为用户友好的文案
      const errorCode = extractErrorCode(authError)
      error.value = getErrorMessage(
        errorCode || authError.code || authError.status?.toString(),
        '更新密码失败，请稍后重试'
      )
      throw authError
    } finally {
      loading.value = false
    }
  }

  /**
   * 监听认证状态变化
   * 注意：订阅应该在 composable 内部管理，避免重复订阅
   */
  let authStateSubscription: ReturnType<
    typeof supabase.auth.onAuthStateChange
  > | null = null

  const setupAuthListener = () => {
    if (authStateSubscription) {
      return // 已设置，避免重复订阅
    }

    authStateSubscription = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
      }
    )
  }

  // 取消订阅
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
    isEmailVerified: computed(() => user.value?.email_confirmed_at !== null),

    // 方法
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    initialize,
    unsubscribe
  }
}
