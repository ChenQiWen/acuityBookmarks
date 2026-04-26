#!/usr/bin/env node

/**
 * Supabase 连接测试脚本
 * 
 * 用途：测试 Supabase 服务是否可用
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function parseEnvFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const env = {}

  content.split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return

    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  })

  return env
}

async function testSupabaseConnection() {
  log('\n🔍 测试 Supabase 连接...\n', 'cyan')

  // 读取配置
  const env = parseEnvFile(join(rootDir, '.env.local'))
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    log('❌ 缺少 Supabase 配置', 'red')
    process.exit(1)
  }

  log(`📍 Supabase URL: ${supabaseUrl}`, 'blue')
  log(`🔑 Anon Key: ${supabaseKey.substring(0, 20)}...\n`, 'blue')

  // 测试 1: 检查 Supabase 服务是否可访问
  log('测试 1: 检查 Supabase 服务状态...', 'cyan')
  try {
    const response = await fetch(supabaseUrl)
    if (response.ok) {
      log('✅ Supabase 服务可访问', 'green')
    } else {
      log(`⚠️  Supabase 返回状态码: ${response.status}`, 'yellow')
    }
  } catch (error) {
    log(`❌ 无法连接到 Supabase: ${error.message}`, 'red')
    log('\n可能的原因:', 'yellow')
    log('  1. Supabase 服务暂时不可用', 'yellow')
    log('  2. 网络连接问题', 'yellow')
    log('  3. 项目 URL 配置错误', 'yellow')
    log('\n建议:', 'cyan')
    log('  - 访问 https://status.supabase.com/ 查看服务状态', 'cyan')
    log('  - 稍后再试', 'cyan')
    process.exit(1)
  }

  // 测试 2: 测试 Auth API
  log('\n测试 2: 测试 Auth API...', 'cyan')
  try {
    const authUrl = `${supabaseUrl}/auth/v1/health`
    const response = await fetch(authUrl)
    
    if (response.ok) {
      log('✅ Auth API 正常', 'green')
    } else {
      log(`⚠️  Auth API 返回状态码: ${response.status}`, 'yellow')
    }
  } catch (error) {
    log(`❌ Auth API 测试失败: ${error.message}`, 'red')
  }

  // 测试 3: 测试 OAuth 配置
  log('\n测试 3: 检查 OAuth 配置...', 'cyan')
  try {
    const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google`
    const response = await fetch(oauthUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey
      },
      redirect: 'manual'
    })
    
    if (response.status === 302 || response.status === 301) {
      log('✅ OAuth 端点可访问', 'green')
      const location = response.headers.get('location')
      if (location) {
        log(`   重定向到: ${location.substring(0, 50)}...`, 'blue')
      }
    } else {
      log(`⚠️  OAuth 端点返回状态码: ${response.status}`, 'yellow')
    }
  } catch (error) {
    log(`❌ OAuth 配置测试失败: ${error.message}`, 'red')
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan')
  log('✅ 连接测试完成！', 'green')
  log('\n下一步:', 'cyan')
  log('  1. 确保在 Supabase Dashboard 中配置了回调 URL', 'cyan')
  log('  2. 访问 http://localhost:3001/login 测试登录', 'cyan')
}

testSupabaseConnection().catch(error => {
  log(`\n❌ 测试失败: ${error.message}`, 'red')
  process.exit(1)
})
