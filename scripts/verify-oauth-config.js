/**
 * 在浏览器控制台中运行此脚本，验证 OAuth 配置
 *
 * 使用方法：
 * 1. 打开扩展的登录页面
 * 2. 打开浏览器控制台（F12）
 * 3. 复制并粘贴此脚本
 * 4. 按 Enter 运行
 */

;(async function () {
  console.log('🔍 OAuth 配置验证\n')
  console.log('═'.repeat(70))

  // 1. 检查扩展 ID
  const extensionId = chrome.runtime.id
  const chromiumappUrl = `https://${extensionId}.chromiumapp.org/`

  console.log('\n📦 扩展信息：')
  console.log(`   Extension ID: ${extensionId}`)
  console.log(`   需要配置的重定向 URL: ${chromiumappUrl}`)

  // 2. 检查 Supabase 配置
  console.log('\n🔧 Supabase 配置：')

  // 尝试从页面中获取 Supabase 配置
  let supabaseUrl = ''
  let supabaseKey = ''

  try {
    // 如果页面中有 supabase 客户端实例
    if (window.supabase) {
      supabaseUrl = window.supabase.supabaseUrl
      console.log(`   ✅ Supabase URL: ${supabaseUrl}`)
    } else {
      console.log('   ⚠️ 无法从页面获取 Supabase 配置')
      console.log('   请检查 frontend/.env.local 文件')
    }
  } catch (e) {
    console.log('   ⚠️ 无法读取 Supabase 配置:', e.message)
  }

  // 3. 测试 Supabase OAuth URL 生成
  console.log('\n🧪 测试 OAuth 流程：')

  try {
    // 动态导入 Supabase 客户端（如果可用）
    const { supabase } = await import('/src/infrastructure/supabase/client.ts')

    console.log('   ✅ Supabase 客户端已加载')
    console.log(`   Supabase URL: ${supabase.supabaseUrl}`)

    // 测试生成 OAuth URL
    console.log('\n   正在测试 Google OAuth URL 生成...')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: chromiumappUrl,
        skipBrowserRedirect: true
      }
    })

    if (error) {
      console.error('   ❌ OAuth URL 生成失败:', error.message)
      console.error('   错误详情:', error)
    } else if (data?.url) {
      console.log('   ✅ OAuth URL 生成成功')
      console.log(`   URL 长度: ${data.url.length} 字符`)
      console.log(`   URL 前缀: ${data.url.substring(0, 50)}...`)

      // 检查 URL 中是否包含正确的重定向 URL
      if (data.url.includes(encodeURIComponent(chromiumappUrl))) {
        console.log('   ✅ 重定向 URL 已正确编码到授权 URL 中')
      } else {
        console.warn('   ⚠️ 重定向 URL 可能未正确配置')
      }
    } else {
      console.error('   ❌ 未返回 OAuth URL')
    }
  } catch (e) {
    console.error('   ❌ 测试失败:', e.message)
    console.error('   详细错误:', e)
  }

  // 4. 配置检查清单
  console.log('\n═'.repeat(70))
  console.log('\n📋 配置检查清单：')
  console.log('\n1. ✅ 扩展 ID 已获取:', extensionId)
  console.log('\n2. 需要在 Supabase Dashboard 中验证：')
  console.log(`   - 项目: ${supabaseUrl || 'ugxgxytykxblctsyulsg.supabase.co'}`)
  console.log('   - 路径: Authentication → URL Configuration → Redirect URLs')
  console.log(`   - 确认包含: ${chromiumappUrl}`)
  console.log('\n3. 需要在 Google Cloud Console 中验证：')
  console.log(
    `   - 确认包含回调 URL: ${supabaseUrl || 'https://ugxgxytykxblctsyulsg.supabase.co'}/auth/v1/callback`
  )
  console.log('\n4. 需要在 Supabase Dashboard 中验证：')
  console.log('   - 路径: Authentication → Providers → Google')
  console.log('   - 确认 Google Provider 已启用')
  console.log('   - 确认 Client ID 和 Secret 已配置')

  console.log('\n═'.repeat(70))
  console.log('\n')
})()
