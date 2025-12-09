/**
 * OAuth 调试工具
 * 用于测试和诊断 OAuth 登录问题
 */

/**
 * 测试后端 OAuth 配置
 * 
 * @param provider - OAuth 提供商（google 或 microsoft）
 * @returns Promise<any> - 后端 OAuth 配置数据
 */
export async function testOAuthConfig(
  provider: 'google' | 'microsoft' = 'microsoft'
) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://localhost:8787'
  const testUrl = `${baseUrl}/api/auth/providers`

  console.log(`[OAuth Debug] 测试后端 OAuth 配置: ${testUrl}`)

  try {
    const response = await fetch(testUrl)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`[OAuth Debug] 后端 OAuth 配置:`, data)

    // 检查指定的 provider 是否配置
    const providerConfig = data.providers[provider]
    console.log(`[OAuth Debug] ${provider} 配置状态:`, {
      enabled: providerConfig,
      hasSecret: data.providers[`${provider}HasSecret`]
    })

    if (!providerConfig) {
      console.warn(`[OAuth Debug] ⚠️ ${provider} OAuth 未配置！`)
      console.warn(
        `[OAuth Debug] 请在 backend/.dev.vars 中设置 AUTH_${provider.toUpperCase()}_CLIENT_ID 和 AUTH_${provider.toUpperCase()}_CLIENT_SECRET`
      )
    } else {
      console.log(`[OAuth Debug] ✅ ${provider} OAuth 配置正常`)
    }

    return data
  } catch (error) {
    console.error(`[OAuth Debug] ❌ 测试失败:`, error)

    if (error instanceof Error) {
      if (
        error.message.includes('Failed to fetch') ||
        error.message.includes('ERR_CONNECTION_REFUSED')
      ) {
        console.error(
          `[OAuth Debug] 💡 提示: 请确保后端服务正在运行: bun run dev:backend`
        )
      } else if (
        error.message.includes('HTTP 403') ||
        error.message.includes('HTTP 401')
      ) {
        console.error(`[OAuth Debug] 💡 提示: 后端服务可能需要认证或权限配置`)
      }
    }

    throw error
  }
}

/**
 * 测试 OAuth 启动端点
 * 
 * @param provider - OAuth 提供商（google 或 microsoft）
 * @returns Promise<any> - OAuth 启动响应数据，包含授权 URL
 */
export async function testOAuthStart(
  provider: 'google' | 'microsoft' = 'microsoft'
) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://localhost:8787'
  const redirectUri = `https://test.chromiumapp.org/`
  const startUrl = `${baseUrl}/api/auth/start?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`

  console.log(`[OAuth Debug] 测试 OAuth 启动: ${startUrl}`)

  try {
    const response = await fetch(startUrl)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} - ${errorText}`
      )
    }

    const data = await response.json()
    console.log(`[OAuth Debug] OAuth 启动成功:`, data)

    if (data.authUrl) {
      console.log(`[OAuth Debug] ✅ 获取到授权 URL: ${data.authUrl}`)
    }

    return data
  } catch (error) {
    console.error(`[OAuth Debug] ❌ OAuth 启动失败:`, error)
    throw error
  }
}

/**
 * 在浏览器控制台中运行 OAuth 调试
 * 
 * 依次测试后端配置和 OAuth 启动流程，输出诊断信息到控制台
 */
export function runOAuthDebug() {
  console.group('🔍 OAuth 调试开始')

  // 测试后端连接
  testOAuthConfig('microsoft')
    .then(() => testOAuthStart('microsoft'))
    .then(() => {
      console.log('✅ 所有 OAuth 测试通过')
    })
    .catch(error => {
      console.error('❌ OAuth 测试失败:', error)
    })
    .finally(() => {
      console.groupEnd()
    })
}

// 在开发环境中，将调试函数暴露到全局对象
if (import.meta.env.DEV) {
  const debugTools = {
    testConfig: testOAuthConfig,
    testStart: testOAuthStart,
    runDebug: runOAuthDebug
  }

  ;(window as unknown as Record<string, unknown>).oauthDebug = debugTools

  console.log(
    '💡 OAuth 调试工具已加载！在控制台运行 oauthDebug.runDebug() 开始诊断'
  )
}
