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
import type { User, Session, AuthError } from '@supabase/supabase-js'

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
      const {
        data: { session: currentSession },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw sessionError
      }

      session.value = currentSession
      user.value = currentSession?.user ?? null
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '获取 session 失败'
      console.error('[useSupabaseAuth] 初始化失败:', authError)
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
          emailRedirectTo: chrome.runtime.getURL('auth.html')
        }
      })

      if (signUpError) {
        // 处理重复注册错误
        const errorCode = signUpError.code || signUpError.status || ''
        const errorMessage = signUpError.message || ''

        // Supabase 可能的重复邮箱错误代码
        if (
          errorCode === 'email_address_not_authorized' ||
          errorCode === 'signup_disabled' ||
          errorMessage.includes('User already registered') ||
          errorMessage.includes('already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('email already registered') ||
          errorMessage.includes('duplicate key value')
        ) {
          throw new Error('该邮箱已被注册，请直接登录或使用其他邮箱')
        }

        throw signUpError
      }

      // 检查是否邮箱已存在但未验证的情况
      // Supabase 在邮箱确认模式下，即使邮箱已存在也可能返回成功
      // 但会返回 null user 或已存在的 user
      if (data.user) {
        // 检查用户是否是新创建的（通过 created_at 判断）
        // 如果用户创建时间不是刚刚（比如超过1分钟），说明可能是已存在的用户
        const userCreatedAt = new Date(data.user.created_at)
        const now = new Date()
        const timeDiff = now.getTime() - userCreatedAt.getTime()

        // 如果用户创建时间超过1分钟，且没有 session，可能是重复注册
        if (timeDiff > 60000 && !data.session) {
          // 尝试登录来验证是否真的是已存在的用户
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email,
              password
            })

          // 如果可以登录，说明邮箱已存在
          if (signInData?.user && !signInError) {
            throw new Error('该邮箱已被注册，请直接登录')
          }
        }

        user.value = data.user
        session.value = data.session
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        // Supabase 默认需要邮箱验证，如果未验证会返回 null session
        needsEmailVerification: !data.session
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

      error.value = authError.message || '注册失败'
      throw authError
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
        // 处理常见的 Supabase 错误，提供更友好的错误信息
        let friendlyMessage = signInError.message || '登录失败'

        // 根据错误代码提供更具体的提示
        // Supabase 错误代码可能是字符串或对象
        const errorCode = signInError.code || signInError.status || ''
        const errorMessage = signInError.message || ''

        // 检查是否是邮箱未验证导致的错误
        if (
          errorCode === 'email_not_confirmed' ||
          errorMessage.includes('Email not confirmed') ||
          errorMessage.includes('email_not_confirmed') ||
          errorMessage.includes('Email not verified')
        ) {
          friendlyMessage =
            '请先验证邮箱。请检查您的邮箱并点击验证链接完成注册后才能登录'
        } else if (
          errorMessage.includes('Invalid login credentials') ||
          errorMessage.includes('invalid_credentials') ||
          errorCode === 'invalid_credentials'
        ) {
          // 如果邮箱未验证，Supabase 也可能返回 invalid_credentials
          // 但我们无法区分，所以先提示邮箱或密码错误
          friendlyMessage =
            '邮箱或密码错误，请检查后重试。如果刚注册，请先验证邮箱'
        } else if (errorMessage.includes('User not found')) {
          friendlyMessage = '用户不存在，请先注册'
        } else if (errorMessage.includes('Too many requests')) {
          friendlyMessage = '登录尝试次数过多，请稍后再试'
        }

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
      error.value = authError.message || '登录失败'
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
        throw resetError
      }

      return { success: true }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '发送重置邮件失败'
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
        throw updateError
      }

      return { success: true }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '更新密码失败'
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
