/**
 * 新的 OAuth 登录实现（使用自定义后端 API）
 */

/**
 * OAuth 登录（使用自定义后端 API + Chrome Extension WebAuthFlow）
 *
 * 完整流程：
 * 1. 调用后端 API 获取授权 URL
 * 2. 使用 chrome.identity.launchWebAuthFlow 启动 OAuth 流程
 * 3. 用户授权后，后端处理回调并返回到 auth.html
 * 4. 从重定向 URL 中提取 code 并与后端交换 token
 * 5. 使用 token 登录 Supabase 并设置 session
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
    // 🔑 调用后端 API 获取授权 URL
    // 使用当前环境的基础 URL，而不是硬编码的 localhost:8787
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL || 'https://localhost:8787'
    const startUrl = `${baseUrl}/api/auth/start?provider=${provider}&redirect_uri=${encodeURIComponent(chromiumappRedirectUrl)}`

    console.log('[OAuth] 请求后端 OAuth URL:', startUrl)

    console.log('[OAuth] 发送请求到后端:', startUrl)

    const response = await fetch(startUrl)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[OAuth] 后端 API 错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(
        `后端 API 错误: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    console.log('[OAuth] 后端响应:', data)

    if (!data.success || !data.authUrl) {
      console.error('[OAuth] 后端返回失败:', data)
      throw new Error(data.error || '获取授权 URL 失败')
    }

    console.log('[OAuth] 获取到授权 URL:', data.authUrl)

    // 🔧 使用 Chrome Extension WebAuthFlow
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: data.authUrl,
          interactive: true
        },
        responseUrl => {
          if (chrome.runtime.lastError) {
            const errorMsg =
              chrome.runtime.lastError.message || 'OAuth 授权失败'
            console.error('[OAuth] WebAuthFlow 错误:', errorMsg)
            reject(new Error(errorMsg))
            return
          }

          if (!responseUrl) {
            console.log('[OAuth] 用户取消了授权')
            reject(new Error('用户取消了授权'))
            return
          }

          console.log('[OAuth] 授权成功，回调 URL:', responseUrl)

          // 重定向到 auth.html 处理回调
          const finalUrl =
            authPageUrl +
            '#' +
            new URLSearchParams({
              provider,
              callback: responseUrl
            }).toString()

          console.log('[OAuth] 跳转到认证页面:', finalUrl)
          window.location.href = finalUrl

          resolve({ success: true })
        }
      )
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'OAuth 登录失败'
    console.error('[OAuth] 错误:', errorMsg)
    throw err
  }
}
