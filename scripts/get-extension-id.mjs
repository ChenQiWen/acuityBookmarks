#!/usr/bin/env node

/**
 * 获取 Chrome Extension ID 的脚本
 * 
 * 用途：帮助用户找到当前安装的扩展 ID，并生成需要配置的 OAuth 重定向 URL
 */

console.log('🔍 如何获取 Chrome Extension ID\n')
console.log('─'.repeat(60))
console.log('\n步骤：')
console.log('1. 打开 Chrome 浏览器')
console.log('2. 访问 chrome://extensions/')
console.log('3. 确保右上角的"开发者模式"已开启')
console.log('4. 找到 "AcuityBookmarks" 扩展')
console.log('5. 复制扩展 ID（32 个字符的字符串）')
console.log('\n示例扩展 ID：')
console.log('  gdjcmpenmogdikhnnaebmddhmdgbfcgl')
console.log('\n─'.repeat(60))
console.log('\n📝 需要在 Supabase 中配置的重定向 URL：')
console.log('\n格式：')
console.log('  https://<你的扩展ID>.chromiumapp.org/')
console.log('\n示例：')
console.log('  https://gdjcmpenmogdikhnnaebmddhmdgbfcgl.chromiumapp.org/')
console.log('\n⚠️ 注意：')
console.log('  - URL 末尾必须有斜杠 /')
console.log('  - 必须使用 https 协议')
console.log('  - 域名必须是 .chromiumapp.org')
console.log('\n─'.repeat(60))
console.log('\n🔧 配置步骤：')
console.log('1. 获取你的扩展 ID（按照上面的步骤）')
console.log('2. 访问 Supabase Dashboard')
console.log('3. 进入 Authentication → URL Configuration')
console.log('4. 在 Redirect URLs 中添加：')
console.log('   https://<你的扩展ID>.chromiumapp.org/')
console.log('5. 点击 Save')
console.log('\n✅ 配置完成后，重新加载扩展并测试 OAuth 登录')
