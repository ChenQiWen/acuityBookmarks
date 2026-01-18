/**
 * OAuth 登录诊断脚本
 *
 * 用途：诊断 Google OAuth 登录"无法连接服务器"问题
 *
 * 使用方法：
 * 1. 在浏览器控制台运行此脚本
 * 2. 或在 Chrome Extension 的 background script 中运行
 */

async function diagnoseOAuth() {
  console.log('=== OAuth 登录诊断开始 ===\n')

  // 1. 检查环境变量
  console.log('1️⃣ 检查 Supabase 配置...')
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 环境变量未配置')
    console.log('请检查 .env.local 文件中的配置：')
    console.log('  - VITE_SUPABASE_URL')
    console.log('  - VITE_SUPABASE_ANON_KEY')
    return
  }

  console.log('✅ Supabase 配置存在')
  console.log(`   URL: ${supabaseUrl}`)
  console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...`)

  // 2. 检查 Supabase 连接
  console.log('\n2️⃣ 检查 Supabase 连接...')
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    })

    if (response.ok) {
      console.log('✅ Supabase API 连接正常')
    } else {
      console.error(
        `❌ Supabase API 返回错误: ${response.status} ${response.statusText}`
      )
      const text = await response.text()
      console.error(`   响应内容: ${text}`)
    }
  } catch (error) {
    console.error('❌ 无法连接到 Supabase API')
    console.error(`   错误: ${error}`)
    console.log('\n可能的原因：')
    console.log('  1. 网络连接问题')
    console.log('  2. Supabase URL 配置错误')
    console.log('  3. 防火墙或代理阻止连接')
    return
  }

  // 3. 检查 Chrome Extension 环境
  console.log('\n3️⃣ 检查 Chrome Extension 环境...')
  if (typeof chrome === 'undefined') {
    console.error('❌ 不在 Chrome Extension 环境中')
    return
  }

  if (!chrome.identity?.launchWebAuthFlow) {
    console.error('❌ chrome.identity API 不可用')
    console.log('   请检查 manifest.json 中是否包含 "identity" 权限')
    return
  }

  console.log('✅ Chrome Extension 环境正常')
  console.log(`   Extension ID: ${chrome.runtime.id}`)

  // 4. 检查 OAuth 重定向 URL
  console.log('\n4️⃣ 检查 OAuth 重定向 URL...')
  const extensionId = chrome.runtime.id
  const chromiumappRedirectUrl = `https://${extensionId}.chromiumapp.org/`
  console.log(`   重定向 URL: ${chromiumappRedirectUrl}`)
  console.log('\n⚠️ 请确保此 URL 已添加到 Supabase Dashboard：')
  console.log('   1. 打开 Supabase Dashboard')
  console.log('   2. 进入 Authentication → URL Configuration')
  console.log('   3. 在 "Redirect URLs" 中添加上述 URL')

  // 5. 测试 OAuth 授权 URL 生成
  console.log('\n5️⃣ 测试 OAuth 授权 URL 生成...')
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: chromiumappRedirectUrl,
        skipBrowserRedirect: true
      }
    })

    if (error) {
      console.error('❌ 生成 OAuth 授权 URL 失败')
      console.error(`   错误: ${error.message}`)
      console.log('\n可能的原因：')
      console.log('  1. Google OAuth 未在 Supabase Dashboard 中启用')
      console.log('  2. Google OAuth Client ID/Secret 未配置')
      console.log('\n请检查 Supabase Dashboard：')
      console.log('  1. 进入 Authentication → Providers')
      console.log('  2. 启用 Google 提供商')
      console.log('  3. 填入 Google OAuth Client ID 和 Client Secret')
      return
    }

    if (!data.url) {
      console.error('❌ 未获取到授权 URL')
      return
    }

    console.log('✅ OAuth 授权 URL 生成成功')
    console.log(`   URL: ${data.url}`)

    // 检查 URL 中的 redirect_uri 参数
    const authUrl = new URL(data.url)
    const redirectUri = authUrl.searchParams.get('redirect_uri')
    console.log(`   redirect_uri 参数: ${redirectUri}`)

    if (redirectUri !== chromiumappRedirectUrl) {
      console.warn('⚠️ redirect_uri 不匹配！')
      console.log(`   期望: ${chromiumappRedirectUrl}`)
      console.log(`   实际: ${redirectUri}`)
      console.log('\n这可能导致 OAuth 流程失败。请检查：')
      console.log(
        '  1. Supabase Dashboard → Authentication → URL Configuration'
      )
      console.log('  2. 确保 Redirect URLs 中包含正确的 chromiumapp.org URL')
    } else {
      console.log('✅ redirect_uri 匹配')
    }
  } catch (error) {
    console.error('❌ 测试失败')
    console.error(`   错误: ${error}`)
  }

  console.log('\n=== OAuth 登录诊断完成 ===')
  console.log('\n📋 诊断总结：')
  console.log('如果所有检查都通过，但仍然无法登录，请：')
  console.log('  1. 打开浏览器开发者工具（F12）')
  console.log('  2. 切换到 Console 标签')
  console.log('  3. 点击"使用 Google 登录"按钮')
  console.log('  4. 查看控制台中的详细错误信息')
  console.log('  5. 将错误信息提供给开发者')
}

// 运行诊断
diagnoseOAuth().catch(console.error)
