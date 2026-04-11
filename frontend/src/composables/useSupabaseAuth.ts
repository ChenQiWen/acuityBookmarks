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
import { logger } from '@/infrastructure/logging/logger'

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
  logger.debug(`[OAuth Debug] 🚀 开始 OAuth 流程，provider: ${provider}`)
  logger.debug(`[OAuth Debug] 🔍 环境检查:`)
  logger.debug(`  - typeof chrome: ${typeof chrome}`)
  logger.debug(`  - chrome.runtime: ${!!chrome?.runtime}`)
  logger.debug(`  - chrome.identity: ${!!chrome?.identity}`)
  logger.debug(
    `  - chrome.identity.launchWebAuthFlow: ${typeof chrome?.identity?.launchWebAuthFlow}`
  )

  // Chrome Extension 环境检查
  if (typeof chrome === 'undefined') {
    logger.error('[OAuth Debug] ❌ chrome 对象未定义')
    throw new Error('当前环境不支持 OAuth 登录 - chrome 对象未定义')
  }

  if (!chrome.identity?.launchWebAuthFlow) {
    logger.error('[OAuth Debug] ❌ chrome.identity.launchWebAuthFlow 不存在')
    logger.error('[OAuth Debug] chrome.identity:', chrome.identity)
    throw new Error(
      '当前环境不支持 OAuth 登录 - chrome.identity.launchWebAuthFlow 不可用'
    )
  }

  const extensionId = chrome.runtime.id
  const chromiumappRedirectUrl = `https://${extensionId}.chromiumapp.org/`
  const authPageUrl = chrome.runtime.getURL('auth.html')

  logger.debug('[OAuth] 配置:', {
    provider,
    extensionId,
    chromiumappRedirectUrl,
    authPageUrl
  })

  try {
    // 🔑 调用 Supabase signInWithOAuth 获取授权 URL
    logger.debug('[OAuth] 调用 Supabase signInWithOAuth...')
    
    // Supabase 使用 'azure' 作为 Microsoft 的 provider 名称
    const supabaseProvider = provider === 'microsoft' ? 'azure' : provider
    
    // 🔧 对于 Chrome Extension，我们需要使用 Chrome Extension 的回调 URL
    // 这样 OAuth 提供商会直接回调到扩展，而不是经过 Supabase 服务器
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider as 'google' | 'azure',
      options: {
        redirectTo: chromiumappRedirectUrl,
        skipBrowserRedirect: true, // 不自动跳转，我们手动处理
        scopes: provider === 'microsoft' 
          ? 'openid profile email User.Read' // Microsoft/Azure 基本权限（包括访问小尺寸用户照片）
          : undefined,
        queryParams: provider === 'google' ? {
          access_type: 'offline',
          prompt: 'consent'
        } : provider === 'microsoft' ? {
          prompt: 'consent' // Microsoft 也需要 consent 以获取完整权限
        } : undefined
      }
    })

    if (oauthError) {
      logger.error('[OAuth] Supabase signInWithOAuth 错误:', oauthError)
      throw new Error(`Supabase OAuth 错误: ${oauthError.message}`)
    }

    if (!data?.url) {
      logger.error('[OAuth] Supabase 未返回授权 URL')
      throw new Error('未获取到授权 URL')
    }

    logger.debug('[OAuth] 获取到 Supabase 授权 URL:', data.url)
    logger.debug('[OAuth] 授权 URL 长度:', data.url.length)
    logger.debug('[OAuth] 授权 URL 前100个字符:', data.url.substring(0, 100))

    // 🔧 使用 Chrome Extension WebAuthFlow
    logger.debug('[OAuth] 准备调用 chrome.identity.launchWebAuthFlow...')
    return new Promise((resolve, reject) => {
      try {
        chrome.identity.launchWebAuthFlow(
          {
            url: data.url,
            interactive: true
          },
          responseUrl => {
            logger.debug('[OAuth] launchWebAuthFlow 回调被调用')
            logger.debug('[OAuth] responseUrl:', responseUrl)
            logger.debug('[OAuth] chrome.runtime.lastError:', chrome.runtime.lastError)

            if (chrome.runtime.lastError) {
              const errorMsg =
                chrome.runtime.lastError.message || 'OAuth 授权失败'
              logger.error('[OAuth] WebAuthFlow 错误:', errorMsg)
              logger.error('[OAuth] 完整错误对象:', chrome.runtime.lastError)
              reject(new Error(errorMsg))
              return
            }

            if (!responseUrl) {
              logger.debug('[OAuth] 用户取消了授权（responseUrl 为空）')
              reject(new Error('用户取消了授权'))
              return
            }

            logger.debug('[OAuth] 授权成功，回调 URL:', responseUrl)

            // 🔍 解析回调 URL，提取 access_token 和 refresh_token
            try {
              const callbackUrl = new URL(responseUrl)
              
              // 尝试从 hash 和 search 两个位置提取 token
              const hashFragment = callbackUrl.hash.substring(1) // 移除 # 号
              const searchParams = callbackUrl.searchParams
              
              // 解析所有可能的参数位置
              const hashParams = new URLSearchParams(hashFragment)
              const allHashParams = Array.from(hashParams.entries())
              const allSearchParams = Array.from(searchParams.entries())
              
              logger.debug('[OAuth] 回调 URL 详情:', {
                fullUrl: responseUrl,
                protocol: callbackUrl.protocol,
                host: callbackUrl.host,
                pathname: callbackUrl.pathname,
                hash: callbackUrl.hash,
                search: callbackUrl.search,
                hashFragment,
                searchParamsSize: searchParams.toString().length,
                allHashParams,
                allSearchParams
              })
              
              // 优先从 hash 中提取，如果没有则从 search 中提取
              let accessToken = hashParams.get('access_token')
              let refreshToken = hashParams.get('refresh_token')
              
              if (!accessToken) {
                accessToken = searchParams.get('access_token')
                refreshToken = searchParams.get('refresh_token')
                logger.debug('[OAuth] 从 search 参数中提取 token')
              } else {
                logger.debug('[OAuth] 从 hash 参数中提取 token')
              }
              
              // 如果还是没有，尝试从 code 参数获取（授权码流程）
              const code = searchParams.get('code') || hashParams.get('code')
              
              logger.debug('[OAuth] 提取结果:', {
                hasAccessToken: !!accessToken,
                hasRefreshToken: !!refreshToken,
                hasCode: !!code,
                accessTokenLength: accessToken?.length,
                refreshTokenLength: refreshToken?.length,
                codeLength: code?.length
              })

              if (accessToken && refreshToken) {
                // 直接返回了 token (隐式流程)
                const finalUrl = `${authPageUrl}#access_token=${accessToken}&refresh_token=${refreshToken}&type=oauth&provider=${provider}`
                
                logger.debug('[OAuth] ✅ Token 流程: 跳转到认证页面')
                
                // 🔒 环境检查：确保在浏览器环境中运行
                if (typeof window !== 'undefined') {
                  window.location.href = finalUrl
                } else {
                  logger.error('[OAuth] 非浏览器环境，无法跳转')
                  reject(new Error('非浏览器环境，无法完成 OAuth 流程'))
                  return
                }
                
                resolve({ success: true })
              } else if (code) {
                // 🔑 情况2: 返回了授权码 (授权码流程)
                logger.debug('[OAuth] ⚠️ 检测到授权码，但这可能是 OAuth 提供商的授权码')
                logger.debug('[OAuth] 授权码:', code)
                logger.debug('[OAuth] 授权码长度:', code.length)
                
                // 对于 Chrome Extension + Supabase，我们不应该直接收到授权码
                // 授权码应该先发送到 Supabase 服务器，然后 Supabase 会重定向回来并带上 token
                // 如果我们收到了授权码，说明流程有问题
                
                logger.error('[OAuth] ❌ 意外收到授权码，这表明 OAuth 流程配置有问题')
                logger.error('[OAuth] 期望的流程：Azure → Supabase 服务器 → Chrome Extension (带 token)')
                logger.error('[OAuth] 实际的流程：Azure → Chrome Extension (带 code)')
                logger.error('[OAuth] 请检查 Azure 应用的回调 URL 配置')
                
                reject(new Error('OAuth 配置错误：收到授权码而非 token。请检查 Azure 回调 URL 配置。'))
              } else {
                // 🔑 情况3: 既没有 token 也没有授权码
                logger.error('[OAuth] ❌ 回调 URL 中缺少必要的 token 或授权码')
                logger.error('[OAuth] 完整回调 URL:', responseUrl)
                logger.error('[OAuth] URL 长度:', responseUrl.length)
                logger.error('[OAuth] 所有 search 参数:', allSearchParams)
                logger.error('[OAuth] 所有 hash 参数:', allHashParams)
                
                // 检查是否有错误参数
                const errorParam = searchParams.get('error') || hashParams.get('error')
                const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
                
                if (errorParam) {
                  logger.error('[OAuth] ❌ OAuth 提供商返回错误:', {
                    error: errorParam,
                    description: errorDescription
                  })
                  reject(new Error(`OAuth 授权失败: ${errorDescription || errorParam}`))
                } else {
                  reject(new Error('OAuth 回调失败：未找到有效的 token 或授权码'))
                }
              }
            } catch (parseError) {
              logger.error('[OAuth] 解析回调 URL 失败:', parseError)
              reject(new Error(`OAuth 回调解析失败: ${parseError}`))
            }
          }
        )
        logger.debug('[OAuth] launchWebAuthFlow 已调用，等待回调...')
      } catch (launchError) {
        logger.error('[OAuth] 调用 launchWebAuthFlow 时发生异常:', launchError)
        reject(launchError)
      }
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'OAuth 登录失败'
    logger.error('[OAuth] 错误:', errorMsg)
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

      logger.debug('[useSupabaseAuth] 开始 OAuth 登录:', provider)
      
      // 使用新的 OAuth 实现（支持 Google 和 Microsoft）
      await signInWithOAuthNew(provider)
      
      logger.debug('[useSupabaseAuth] OAuth 登录成功')

      // 等待用户信息同步
      await new Promise(resolve => setTimeout(resolve, 500))

      // 刷新用户信息，确保获取到完整的 user_metadata（昵称、头像等）
      try {
        const {
          data: { user: refreshedUser },
          error: refreshError
        } = await supabase.auth.getUser()
        
        if (refreshError) {
          logger.warn('[useSupabaseAuth] ⚠️ 刷新用户信息失败:', refreshError)
        } else if (refreshedUser) {
          logger.debug('[useSupabaseAuth] ✅ 用户信息已刷新:', {
            userId: refreshedUser.id,
            email: refreshedUser.email,
            hasFullName: !!refreshedUser.user_metadata?.full_name,
            hasPicture: !!refreshedUser.user_metadata?.picture
          })
          user.value = refreshedUser
        }
      } catch (refreshErr) {
        logger.warn('[useSupabaseAuth] ⚠️ 刷新用户信息异常:', refreshErr)
      }

      return { success: true }
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || 'OAuth 登录失败'
      logger.error('[useSupabaseAuth] OAuth 登录失败:', authError)
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
