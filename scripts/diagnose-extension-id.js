/**
 * 在浏览器控制台中运行此脚本，获取当前扩展的 ID 和需要配置的 URL
 *
 * 使用方法：
 * 1. 打开扩展的任意页面（如 auth.html）
 * 2. 打开浏览器控制台（F12）
 * 3. 复制并粘贴此脚本
 * 4. 按 Enter 运行
 */

;(function () {
  console.log('🔍 Chrome Extension OAuth 配置诊断\n')
  console.log('═'.repeat(60))

  // 检查 chrome 对象
  if (typeof chrome === 'undefined') {
    console.error('❌ chrome 对象未定义')
    console.log('请确保在 Chrome Extension 页面中运行此脚本')
    return
  }

  // 获取扩展 ID
  const extensionId = chrome.runtime.id
  console.log('\n📦 当前扩展信息：')
  console.log(`   Extension ID: ${extensionId}`)

  // 生成需要配置的 URL
  const chromiumappUrl = `https://${extensionId}.chromiumapp.org/`
  console.log('\n🔗 需要在 Supabase 中配置的重定向 URL：')
  console.log(`   ${chromiumappUrl}`)
  console.log('\n   ⚠️ 请确保此 URL 已添加到：')
  console.log(
    '   Supabase Dashboard → Authentication → URL Configuration → Redirect URLs'
  )

  // 检查 Supabase 配置
  console.log('\n🔧 Supabase 配置检查：')

  // 尝试从环境变量读取（如果可用）
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    console.log(`   VITE_SUPABASE_URL: ${supabaseUrl || '❌ 未配置'}`)
    console.log(
      `   VITE_SUPABASE_ANON_KEY: ${supabaseKey ? '✅ 已配置' : '❌ 未配置'}`
    )

    if (supabaseUrl) {
      const callbackUrl = `${supabaseUrl}/auth/v1/callback`
      console.log(
        '\n🔗 Google OAuth 回调 URL（需要在 Google Cloud Console 中配置）：'
      )
      console.log(`   ${callbackUrl}`)
    }
  }

  // 检查 chrome.identity API
  console.log('\n🔍 Chrome Identity API 检查：')
  console.log(
    `   chrome.identity: ${chrome.identity ? '✅ 可用' : '❌ 不可用'}`
  )
  console.log(
    `   chrome.identity.launchWebAuthFlow: ${chrome.identity?.launchWebAuthFlow ? '✅ 可用' : '❌ 不可用'}`
  )

  console.log('\n═'.repeat(60))
  console.log('\n💡 下一步：')
  console.log('1. 复制上面的 chromiumapp.org URL')
  console.log('2. 在 Supabase Dashboard 中添加此 URL')
  console.log('3. 重新加载扩展')
  console.log('4. 尝试 OAuth 登录')
  console.log('\n')
})()
