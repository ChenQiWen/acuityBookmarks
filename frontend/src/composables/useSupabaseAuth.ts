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

/**
 * 认证状态
 */
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * OAuth 登录实现（使用 Supabase 原生 OAuth + Chrome Extension WebAuthFlow）
 *
 * 完整流程：
 * 1. 调用 Supabase signInWithOAuth 获取授权 URL
 * 2. 使用 chrome.identity.launchWebAuthFlow 启动 OAuth 流程
 * 3. 用户授权后，Supabase 处理回调并返回 token
 * 4. 从重定向 URL 中提取 token 并设置 session
 */
async function signInWithOAuthNew(
  provider: 'google' | 'microsoft'
): Promise<{ success: boolean; url?: string }> {
  console.log(`[OAuth Debug] 🚀 开始 OAuth 流程，provider: ${provider}`)
  console.log(`[OAuth Debug] 🔍 环境检查:`)
  console.log(`  - typeof chrome: ${typeof chrome}`)
  console.log(`  - chrome.runtime: ${!!chrome?.runtime}`)
  console.log(`  - chrome.identity: ${!!chrome?.identity}`)
  console.log(
    `  - chrome.identity.launchWebAuthFlow: ${typeof chrome?.identity?.launchWebAuthFlow}`
  )

  // Chrome Extension 环境检查
  if (typeof chrome === 'undefined') {
    console.error('[OAuth Debug] ❌ chrome 对象未定义')
    throw new Error('当前环境不支持 OAuth 登录 - chrome 对象未定义')
  }

  if (!chrome.identity?.launchWebAuthFlow) {
    console.error('[OAuth Debug] ❌ chrome.identity.launchWebAuthFlow 不存在')
    console.error('[OAuth Debug] chrome.identity:', chrome.identity)
    throw new Error(
      '当前环境不支持 OAuth 登录 - chrome.identity.launchWebAuthFlow 不可用'
    )
  }

  const extensionId = chrome.runtime.id
  const chromiumappRedirectUrl = `https://${extensionId}.chromiumapp.org/`
  const authPageUrl = chrome.runtime.getURL('auth.html')

  console.log('[OAuth] 配置:', {
    provider,
    extensionId,
    chromiumappRedirectUrl,
    authPageUrl
  })

  try {
    // 🔑 调用 Supabase signInWithOAuth 获取授权 URL
    console.log('[OAuth] 调用 Supabase signInWithOAuth...')
    
    // Supabase 使用 'azure' 作为 Microsoft 的 provider 名称
    const supabaseProvider = provider === 'microsoft' ? 'azure' : provider
    
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider as 'google' | 'azure',
      options: {
        redirectTo: chromiumappRedirectUrl,
        skipBrowserRedirect: true, // 不自动跳转，我们手动处理
        queryParams: provider === 'google' ? {
          access_type: 'offline',
          prompt: 'consent'
        } : undefined
      }
    })

    if (oauthError) {
      console.error('[OAuth] Supabase signInWithOAuth 错误:', oauthError)
      throw new Error(`Supabase OAuth 错误: ${oauthError.message}`)
    }

    if (!data?.url) {
      console.error('[OAuth] Supabase 未返回授权 URL')
      throw new Error('未获取到授权 URL')
    }

    console.log('[OAuth] 获取到 Supabase 授权 URL:', data.url)
    console.log('[OAuth] 授权 URL 长度:', data.url.length)
    console.log('[OAuth] 授权 URL 前100个字符:', data.url.substring(0, 100))

    // 🔧 使用 Chrome Extension WebAuthFlow
    console.log('[OAuth] 准备调用 chrome.identity.launchWebAuthFlow...')
    return new Promise((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow(
          {
            url: data.url,
            interactive: true
          },
          responseUrl => {
            console.log('[OAuth] launchWebAuthFlow 回调被调用')
            console.log('[OAuth] responseUrl:', responseUrl)
            console.log('[OAuth] chrome.runtime.lastError:', chrome.runtime.lastError)

            if (chrome.runtime.lastError) {
              const errorMsg =
                chrome.runtime.lastError.message || 'OAuth 授权失败'
              console.error('[OAuth] WebAuthFlow 错误:', errorMsg)
              console.error('[OAuth] 完整错误对象:', chrome.runtime.lastError)
              reject(new Error(errorMsg))
              return
            }

            if (!responseUrl) {
              console.log('[OAuth] 用户取消了授权（responseUrl 为空）')
              reject(new Error('用户取消了授权'))
              return
            }

            console.log('[OAuth] 授权成功，回调 URL:', responseUrl)

            // 🔍 解析回调 URL，提取 access_token 和 refresh_token
            try {
              const callbackUrl = new URL(responseUrl)
              const fragment = callbackUrl.hash.substring(1) // 移除 # 号
              const params = new URLSearchParams(fragment)
              
              const accessToken = params.get('access_token')
              const refreshToken = params.get('refresh_token')
              
              console.log('[OAuth] 提取 token:', {
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!refreshToken,
                accessTokenLength: accessToken?.length,
                refreshTokenLength: refreshToken?.length
              })

              if (accessToken && refreshToken) {
                // 🔑 直接跳转到 auth.html 并携带 token
                const finalUrl = `${authPageUrl}#access_token=${accessToken}&refresh_token=${refreshToken}&type=oauth&provider=${provider}`
                
                console.log('[OAuth] 跳转到认证页面:', finalUrl)
                window.location.href = finalUrl
                
                resolve({ success: true })
              } else {
                console.error('[OAuth] 回调 URL 中缺少必要的 token')
                reject(new Error('OAuth 回调失败：未找到有效的 token'))
              }
            } catch (parseError) {
              console.error('[OAuth] 解析回调 URL 失败:', parseError)
              reject(new Error(`OAuth 回调解析失败: ${parseError}`))
            }
          }
        )
        console.log('[OAuth] launchWebAuthFlow 已调用，等待回调...')
      } catch (launchError) {
        console.error('[OAuth] 调用 launchWebAuthFlow 时发生异常:', launchError)
        reject(launchError)
      }
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'OAuth 登录失败'
    console.error('[OAuth] 错误:', errorMsg)
    throw err
  }
}

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
