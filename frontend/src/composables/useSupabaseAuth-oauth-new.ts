/**
 * OAuth 登录实现（使用 Supabase 原生 OAuth + Chrome Extension WebAuthFlow）
 */

import { supabase } from '@/infrastructure/supabase/client'

/**
 * OAuth 登录（使用 Supabase 原生 OAuth + Chrome Extension WebAuthFlow）
 *
 * 完整流程：
 * 1. 调用 Supabase signInWithOAuth 获取授权 URL
 * 2. 使用 chrome.identity.launchWebAuthFlow 启动 OAuth 流程
 * 3. 用户授权后，Supabase 处理回调并返回 token
 * 4. 从重定向 URL 中提取 token 并设置 session
 */
export const signInWithOAuthNew = async (
  provider: 'google' | 'microsoft'
): Promise<{ success: boolean; url?: string }> => {
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
    
    const { data, error } = await supabase.auth.signInWithOAuth({
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

    if (error) {
      console.error('[OAuth] Supabase signInWithOAuth 错误:', error)
      throw new Error(`Supabase OAuth 错误: ${error.message}`)
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
