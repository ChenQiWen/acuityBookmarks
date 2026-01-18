#!/usr/bin/env node

/**
 * OAuth 配置检查脚本
 * 
 * 用途：检查 Supabase OAuth 配置是否正确
 */

console.log('🔍 检查 OAuth 配置...\n')

// 1. 检查环境变量
console.log('1️⃣ 检查环境变量')
console.log('─'.repeat(50))

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

console.log(`SUPABASE_URL: ${supabaseUrl || '❌ 未配置'}`)
console.log(`SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ 已配置' : '❌ 未配置'}`)

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'your-anon-key-here') {
  console.log('\n❌ Supabase 环境变量未正确配置！')
  console.log('\n请按以下步骤配置：')
  console.log('1. 访问 Supabase Dashboard: https://supabase.com/dashboard')
  console.log('2. 选择你的项目')
  console.log('3. 进入 Settings → API')
  console.log('4. 复制 "Project URL" 和 "anon public" key')
  console.log('5. 在根目录的 .env 文件中设置：')
  console.log('   SUPABASE_URL=<你的项目URL>')
  console.log('   SUPABASE_ANON_KEY=<你的anon key>')
  console.log('6. 运行 bun run env:sync 同步到各个子项目')
  process.exit(1)
}

console.log('\n✅ 环境变量配置正确\n')

// 2. 检查 Chrome Extension ID
console.log('2️⃣ 检查 Chrome Extension 配置')
console.log('─'.repeat(50))

console.log('\n⚠️ 重要：你需要在 Supabase Dashboard 中配置重定向 URL')
console.log('\n步骤：')
console.log('1. 获取你的 Chrome Extension ID：')
console.log('   - 打开 Chrome 浏览器')
console.log('   - 访问 chrome://extensions/')
console.log('   - 找到 AcuityBookmarks 扩展')
console.log('   - 复制扩展 ID（类似：abcdefghijklmnopqrstuvwxyz123456）')
console.log('')
console.log('2. 配置 Supabase 重定向 URL：')
console.log('   - 访问 Supabase Dashboard')
console.log('   - 进入 Authentication → URL Configuration')
console.log('   - 在 "Redirect URLs" 中添加：')
console.log('     https://<你的扩展ID>.chromiumapp.org/')
console.log('   - 例如：https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/')
console.log('')
console.log('3. 配置 Google OAuth：')
console.log('   - 访问 Supabase Dashboard')
console.log('   - 进入 Authentication → Providers')
console.log('   - 启用 Google provider')
console.log('   - 配置 Google OAuth Client ID 和 Secret')
console.log('   - 在 Google Cloud Console 中添加授权重定向 URI：')
console.log(`     ${supabaseUrl}/auth/v1/callback`)
console.log('')

console.log('✅ 配置检查完成')
console.log('\n如果你已经完成上述配置，请重新加载扩展并尝试登录。')
