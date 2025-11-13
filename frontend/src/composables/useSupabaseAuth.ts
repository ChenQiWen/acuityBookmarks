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
      console.log('[useSupabaseAuth] 注册响应:', {
        hasUser: !!data.user,
        hasSession: !!data.session,
        userId: data.user?.id,
        email: data.user?.email
      })

      if (data.user) {
        user.value = data.user
        session.value = data.session

        // 🔑 如果 session 存在，确保保存到存储
        if (data.session) {
          console.log('[useSupabaseAuth] ✅ 注册成功，session 已设置')
          // Supabase 会自动保存 session，但我们可以手动确保
          try {
            await supabase.auth.setSession(data.session)
            console.log('[useSupabaseAuth] ✅ Session 已保存到存储')
          } catch (sessionError) {
            console.warn(
              '[useSupabaseAuth] ⚠️ 保存 session 失败:',
              sessionError
            )
          }
        } else {
          console.warn(
            '[useSupabaseAuth] ⚠️ 注册成功但 session 为 null，可能需要邮箱验证'
          )
        }
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
   * Chrome Extension 环境下的 OAuth 流程（弹窗模式）：
   * 1. 调用 Supabase OAuth API 获取授权 URL
   * 2. 使用 chrome.identity.launchWebAuthFlow 打开授权页面（弹窗）
   * 3. 用户授权后，Supabase 会重定向到 redirectTo URL
   * 4. 从重定向 URL 中提取 token 并设置 session
   * 5. 保存当前登录的 provider 到本地存储
   */
  const signInWithOAuth = async (
    provider: 'google' | 'microsoft'
  ): Promise<{ success: boolean; url?: string }> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置')
    }

    // Chrome Extension 环境检查
    if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
      throw new Error('当前环境不支持 OAuth 登录')
    }

    return new Promise((resolve, reject) => {
      // 🔑 Chrome Extension OAuth 需要使用特殊的 chromiumapp.org 重定向 URI
      // 格式：https://<extension-id>.chromiumapp.org/
      const extensionId = chrome.runtime.id
      const chromiumappRedirectUrl = `https://${extensionId}.chromiumapp.org/`
      const authPageUrl = chrome.runtime.getURL('auth.html')

      console.log('[useSupabaseAuth] Chrome Extension OAuth 配置:', {
        extensionId,
        chromiumappRedirectUrl,
        authPageUrl
      })

      // 注意：Supabase 原生不支持 Microsoft OAuth，这里需要通过自定义实现
      // 对于 Microsoft OAuth，应该使用 signInWithOAuthNew 函数
      if (provider === 'microsoft') {
        throw new Error('Microsoft OAuth 需要使用 signInWithOAuthNew 函数')
      }

      supabase.auth
        .signInWithOAuth({
          provider: provider as 'google', // 只支持 Google
          options: {
            // 🔑 使用 chromiumapp.org 作为重定向 URL（Chrome Extension OAuth 标准）
            // Chrome 会拦截这个重定向并传递给扩展
            redirectTo: chromiumappRedirectUrl,
            skipBrowserRedirect: true, // 🔒 禁用 Supabase 的默认弹窗，只使用 chrome.identity.launchWebAuthFlow
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

          console.log('[useSupabaseAuth] OAuth 授权 URL:', data.url)
          console.log(
            '[useSupabaseAuth] 检查授权 URL 中的 redirect_uri 参数...'
          )

          // 检查授权 URL 中是否包含正确的 redirect_uri
          try {
            const authUrl = new URL(data.url)
            const redirectUri = authUrl.searchParams.get('redirect_uri')
            console.log(
              '[useSupabaseAuth] 授权 URL 中的 redirect_uri:',
              redirectUri
            )

            if (redirectUri && redirectUri !== chromiumappRedirectUrl) {
              console.warn('[useSupabaseAuth] ⚠️ redirect_uri 不匹配:', {
                expected: chromiumappRedirectUrl,
                actual: redirectUri
              })
            }
          } catch (e) {
            console.warn('[useSupabaseAuth] 无法解析授权 URL:', e)
          }

          // Chrome Extension 环境下使用 chrome.identity API（弹窗模式）
          console.log(
            '[useSupabaseAuth] 🔑 准备启动 OAuth 流程，provider:',
            provider
          )

          chrome.identity.launchWebAuthFlow(
            {
              url: data.url,
              interactive: true
            },
            async redirectUrl => {
              loading.value = false

              console.log(
                '[useSupabaseAuth] 🔑 launchWebAuthFlow 回调，provider:',
                provider
              )
              console.log('[useSupabaseAuth] launchWebAuthFlow 回调:', {
                hasError: !!chrome.runtime.lastError,
                errorMessage: chrome.runtime.lastError?.message,
                redirectUrl: redirectUrl || 'null',
                provider: provider // 🔑 确认 provider 值
              })

              if (chrome.runtime.lastError) {
                const errorMessage =
                  chrome.runtime.lastError.message || 'OAuth 登录失败'
                console.error(
                  '[useSupabaseAuth] chrome.identity.launchWebAuthFlow 错误:',
                  {
                    error: errorMessage,
                    redirectUrl: redirectUrl || 'null'
                  }
                )

                // 检查是否是用户取消的情况
                if (
                  errorMessage.includes('canceled') ||
                  errorMessage.includes('closed') ||
                  errorMessage.includes('user cancelled') ||
                  errorMessage.includes(
                    'Authorization page could not be loaded'
                  )
                ) {
                  // "Authorization page could not be loaded" 可能是重定向 URL 格式问题
                  // 但如果 redirectUrl 存在，说明授权可能已经完成，尝试处理
                  if (redirectUrl) {
                    console.log(
                      '[useSupabaseAuth] 检测到错误但有 redirectUrl，尝试处理:',
                      redirectUrl
                    )
                    // 继续处理 redirectUrl，不返回
                  } else {
                    // 用户取消授权，不显示错误（静默失败）
                    console.log('[useSupabaseAuth] 用户取消了 OAuth 授权')
                    error.value = ''
                    reject(new Error('用户取消了授权'))
                    return
                  }
                } else {
                  error.value = errorMessage
                  reject(new Error(errorMessage))
                  return
                }
              }

              if (!redirectUrl) {
                console.error('[useSupabaseAuth] 未获取到重定向 URL')
                error.value = '未获取到重定向 URL'
                reject(new Error('未获取到重定向 URL'))
                return
              }

              try {
                // 从重定向 URL 中提取 token
                console.log('[useSupabaseAuth] OAuth 重定向 URL:', redirectUrl)

                const url = new URL(redirectUrl)
                const hash = url.hash.substring(1)
                const params = new URLSearchParams(hash)

                const accessToken = params.get('access_token')
                const refreshToken = params.get('refresh_token')
                const provider = params.get('provider') // 尝试从 URL 中获取 provider

                console.log('[useSupabaseAuth] 提取到的 token:', {
                  hasAccessToken: !!accessToken,
                  hasRefreshToken: !!refreshToken,
                  provider,
                  urlHost: url.host
                })

                if (accessToken && refreshToken) {
                  const { data: sessionData, error: sessionError } =
                    await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken
                    })

                  if (sessionError) {
                    console.error(
                      '[useSupabaseAuth] 设置 session 失败:',
                      sessionError
                    )
                    error.value = sessionError.message || '设置 session 失败'
                    reject(sessionError)
                  } else {
                    console.log('[useSupabaseAuth] ✅ OAuth 登录成功', {
                      userId: sessionData.user?.id,
                      email: sessionData.user?.email,
                      appProvider: sessionData.user?.app_metadata?.provider,
                      userMetadataProvider:
                        sessionData.user?.user_metadata?.provider,
                      providers: sessionData.user?.user_metadata?.providers,
                      urlProvider: provider,
                      currentProvider: provider, // 🔑 当前登录使用的 provider
                      providerFromClosure: provider // 🔑 确认闭包中的 provider 值
                    })

                    // 🔑 保存当前登录的 provider 到本地存储（因为 Supabase 在账号合并时不会更新 app_metadata.provider）
                    console.log(
                      '[useSupabaseAuth] 🔑 准备保存 provider 到本地存储:',
                      provider
                    )
                    try {
                      const { modernStorage } = await import(
                        '@/infrastructure/storage/modern-storage'
                      )
                      await modernStorage.setLocal(
                        'current_login_provider',
                        provider
                      )

                      // 验证保存是否成功
                      const savedProvider =
                        await modernStorage.getLocal<string>(
                          'current_login_provider'
                        )
                      console.log(
                        '[useSupabaseAuth] ✅ 已保存当前登录 provider:',
                        provider
                      )
                      console.log('[useSupabaseAuth] 🔍 验证保存结果:', {
                        saved: savedProvider,
                        expected: provider,
                        match: savedProvider === provider
                      })

                      if (savedProvider !== provider) {
                        console.error(
                          '[useSupabaseAuth] ❌ Provider 保存验证失败！',
                          {
                            saved: savedProvider,
                            expected: provider
                          }
                        )
                      }
                    } catch (storageError) {
                      console.error(
                        '[useSupabaseAuth] ❌ 保存 provider 到本地存储失败:',
                        storageError
                      )
                    }

                    user.value = sessionData.user
                    session.value = sessionData.session

                    // 🔑 OAuth 登录后，立即刷新用户信息以确保 user_metadata（昵称、头像等）已同步
                    console.log(
                      '[useSupabaseAuth] 🔄 OAuth 登录成功，刷新用户信息...'
                    )
                    try {
                      const {
                        data: { user: refreshedUser },
                        error: refreshError
                      } = await supabase.auth.getUser()
                      if (refreshError) {
                        console.warn(
                          '[useSupabaseAuth] ⚠️ 刷新用户信息失败:',
                          refreshError
                        )
                      } else if (refreshedUser) {
                        console.log('[useSupabaseAuth] ✅ 用户信息已刷新:', {
                          userId: refreshedUser.id,
                          email: refreshedUser.email,
                          hasNickname: !!refreshedUser.user_metadata?.nickname,
                          hasFullName: !!refreshedUser.user_metadata?.full_name,
                          hasPicture: !!refreshedUser.user_metadata?.picture,
                          hasAvatarUrl:
                            !!refreshedUser.user_metadata?.avatar_url
                        })
                        // 更新 user.value 以确保 UI 显示最新的用户信息
                        user.value = refreshedUser
                      }
                    } catch (refreshErr) {
                      console.warn(
                        '[useSupabaseAuth] ⚠️ 刷新用户信息异常:',
                        refreshErr
                      )
                    }

                    resolve({ success: true })
                  }
                } else {
                  console.error(
                    '[useSupabaseAuth] ❌ 未从重定向 URL 中获取到 token',
                    {
                      redirectUrl,
                      hash,
                      accessToken: !!accessToken,
                      refreshToken: !!refreshToken
                    }
                  )
                  error.value = '未从重定向 URL 中获取到 token'
                  reject(new Error('未从重定向 URL 中获取到 token'))
                }
              } catch (err) {
                console.error('[useSupabaseAuth] ❌ 处理 OAuth 回调失败:', err)
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
