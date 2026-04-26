#!/usr/bin/env node

/**
 * Supabase 配置检查脚本
 * 
 * 用途：检查所有项目的 Supabase 配置是否一致
 */

import { readFileSync, existsSync } from 'fs'
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
  if (!existsSync(filePath)) {
    return null
  }

  const content = readFileSync(filePath, 'utf-8')
  const env = {}

  content.split('\n').forEach(line => {
    line = line.trim()
    
    // 跳过注释和空行
    if (!line || line.startsWith('#')) {
      return
    }

    // 解析 KEY=VALUE
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      env[key] = value
    }
  })

  return env
}

function extractProjectId(url) {
  if (!url) return null
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  return match ? match[1] : null
}

function checkConfig() {
  log('\n🔍 检查 Supabase 配置...\n', 'cyan')

  const configs = [
    {
      name: '根目录 .env',
      path: join(rootDir, '.env'),
      urlKey: 'SUPABASE_URL',
      keyKey: 'SUPABASE_ANON_KEY'
    },
    {
      name: '根目录 .env.local',
      path: join(rootDir, '.env.local'),
      urlKey: 'VITE_SUPABASE_URL',
      keyKey: 'VITE_SUPABASE_ANON_KEY'
    },
    {
      name: '插件 .env.local',
      path: join(rootDir, 'frontend', '.env.local'),
      urlKey: 'VITE_SUPABASE_URL',
      keyKey: 'VITE_SUPABASE_ANON_KEY'
    },
    {
      name: '官网 .env',
      path: join(rootDir, 'website', '.env'),
      urlKey: 'SUPABASE_URL',
      keyKey: 'SUPABASE_ANON_KEY'
    }
  ]

  const results = []
  let hasError = false

  configs.forEach(config => {
    const env = parseEnvFile(config.path)
    
    if (!env) {
      log(`❌ ${config.name}: 文件不存在`, 'red')
      hasError = true
      return
    }

    const url = env[config.urlKey]
    const key = env[config.keyKey]
    const projectId = extractProjectId(url)

    results.push({
      name: config.name,
      url,
      projectId,
      hasKey: !!key && key !== 'your-anon-key-here',
      keyPreview: key ? `${key.substring(0, 20)}...` : '未设置'
    })

    log(`📄 ${config.name}:`, 'blue')
    log(`   URL: ${url || '未设置'}`)
    log(`   项目 ID: ${projectId || '未设置'}`)
    log(`   Anon Key: ${key ? (key === 'your-anon-key-here' ? '⚠️  占位符，需要更新' : '✅ 已设置') : '❌ 未设置'}`)
    
    if (!url || !projectId) {
      log(`   ❌ 缺少 Supabase URL`, 'red')
      hasError = true
    }
    
    if (!key || key === 'your-anon-key-here') {
      log(`   ❌ 缺少有效的 Anon Key`, 'red')
      hasError = true
    }
    
    log('')
  })

  // 检查一致性
  log('\n🔄 检查配置一致性...\n', 'cyan')

  const projectIds = results.map(r => r.projectId).filter(Boolean)
  const uniqueProjectIds = [...new Set(projectIds)]

  if (uniqueProjectIds.length === 0) {
    log('❌ 没有找到任何有效的 Supabase 项目 ID', 'red')
    hasError = true
  } else if (uniqueProjectIds.length > 1) {
    log('⚠️  发现多个不同的 Supabase 项目 ID:', 'yellow')
    uniqueProjectIds.forEach(id => {
      const files = results.filter(r => r.projectId === id).map(r => r.name)
      log(`   - ${id}`, 'yellow')
      log(`     使用此 ID 的文件: ${files.join(', ')}`, 'yellow')
    })
    log('\n建议：统一使用同一个 Supabase 项目 ID', 'yellow')
    hasError = true
  } else {
    log(`✅ 所有配置使用相同的项目 ID: ${uniqueProjectIds[0]}`, 'green')
  }

  // 检查 Anon Key
  const hasInvalidKey = results.some(r => !r.hasKey)
  if (hasInvalidKey) {
    log('\n⚠️  部分配置缺少有效的 Anon Key', 'yellow')
    log('请访问以下链接获取 Anon Key:', 'yellow')
    if (uniqueProjectIds.length > 0) {
      log(`https://supabase.com/dashboard/project/${uniqueProjectIds[0]}/settings/api`, 'cyan')
    }
    hasError = true
  }

  // 总结
  log('\n' + '='.repeat(60) + '\n', 'cyan')
  
  if (hasError) {
    log('❌ 配置检查失败，请修复上述问题', 'red')
    log('\n📚 参考文档:', 'cyan')
    log('   - website/GET_SUPABASE_KEY.md', 'cyan')
    log('   - website/SUPABASE_OAUTH_SETUP.md', 'cyan')
    process.exit(1)
  } else {
    log('✅ 所有配置检查通过！', 'green')
    log('\n下一步:', 'cyan')
    log('   1. 确保 Supabase 服务正常运行', 'cyan')
    log('   2. 访问 http://localhost:3001/test-auth 测试配置', 'cyan')
    log('   3. 尝试 OAuth 登录', 'cyan')
  }
}

checkConfig()
