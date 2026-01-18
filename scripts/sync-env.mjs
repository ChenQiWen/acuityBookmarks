#!/usr/bin/env bun
/**
 * 环境变量同步脚本
 * 
 * 功能：
 * - 从根目录的 .env 文件读取环境变量
 * - 自动同步到各子项目的配置文件
 * - 避免在多个地方重复维护相同的环境变量
 * 
 * 使用方法：
 * bun run env:sync
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT_DIR = process.cwd()
const ROOT_ENV_FILE = join(ROOT_DIR, '.env')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

/**
 * 解析 .env 文件
 */
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {}
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

/**
 * 生成 .env 文件内容
 */
function generateEnvContent(vars, template = '') {
  const lines = []
  
  if (template) {
    lines.push(template)
    lines.push('')
  }

  for (const [key, value] of Object.entries(vars)) {
    lines.push(`${key}=${value}`)
  }

  return lines.join('\n')
}

/**
 * 同步到 Website（Nuxt）
 */
function syncToWebsite(rootEnv) {
  const websiteEnvPath = join(ROOT_DIR, 'website', '.env')
  
  const websiteVars = {
    SUPABASE_URL: rootEnv.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: rootEnv.SUPABASE_ANON_KEY || '',
    NUXT_PUBLIC_SITE_URL: rootEnv.NUXT_PUBLIC_SITE_URL || 'https://acuitybookmarks.com'
  }

  const template = `# ============================================
# Website 环境变量（自动生成）
# ============================================
# ⚠️ 此文件由 scripts/sync-env.mjs 自动生成
# ⚠️ 请勿手动编辑，改动会被覆盖
# ⚠️ 请在根目录的 .env 文件中修改
# ============================================`

  const content = generateEnvContent(websiteVars, template)
  writeFileSync(websiteEnvPath, content, 'utf-8')
  
  log(`  ✅ website/.env`, 'green')
  log(`     - SUPABASE_URL: ${websiteVars.SUPABASE_URL ? '已设置' : '未设置'}`, 'gray')
  log(`     - SUPABASE_ANON_KEY: ${websiteVars.SUPABASE_ANON_KEY ? '已设置' : '未设置'}`, 'gray')
}

/**
 * 同步到 Frontend（Chrome Extension）
 */
function syncToFrontend(rootEnv) {
  const frontendEnvPath = join(ROOT_DIR, 'frontend', '.env.local')
  
  // 优先使用 VITE_ 前缀的变量，如果不存在则使用无前缀的
  const frontendVars = {
    VITE_SUPABASE_URL: rootEnv.VITE_SUPABASE_URL || rootEnv.SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: rootEnv.VITE_SUPABASE_ANON_KEY || rootEnv.SUPABASE_ANON_KEY || '',
    VITE_API_BASE_URL: rootEnv.API_BASE_URL || '',
    VITE_CLOUDFLARE_WORKER_URL: rootEnv.CLOUDFLARE_WORKER_URL || ''
  }

  const template = `# ============================================
# Frontend 环境变量（自动生成）
# ============================================
# ⚠️ 此文件由 scripts/sync-env.mjs 自动生成
# ⚠️ 请勿手动编辑，改动会被覆盖
# ⚠️ 请在根目录的 .env 文件中修改
# ============================================`

  const content = generateEnvContent(frontendVars, template)
  writeFileSync(frontendEnvPath, content, 'utf-8')
  
  log(`  ✅ frontend/.env.local`, 'green')
  log(`     - VITE_SUPABASE_URL: ${frontendVars.VITE_SUPABASE_URL ? '已设置' : '未设置'}`, 'gray')
  log(`     - VITE_SUPABASE_ANON_KEY: ${frontendVars.VITE_SUPABASE_ANON_KEY ? '已设置' : '未设置'}`, 'gray')
}

/**
 * 更新 Backend wrangler.toml
 */
function syncToBackend(rootEnv) {
  const wranglerPath = join(ROOT_DIR, 'backend', 'wrangler.toml')
  
  if (!existsSync(wranglerPath)) {
    log(`  ⚠️  backend/wrangler.toml 不存在`, 'yellow')
    return
  }

  let content = readFileSync(wranglerPath, 'utf-8')
  
  // 更新 SUPABASE_URL
  if (rootEnv.SUPABASE_URL) {
    content = content.replace(
      /SUPABASE_URL\s*=\s*"[^"]*"/,
      `SUPABASE_URL = "${rootEnv.SUPABASE_URL}"`
    )
  }

  writeFileSync(wranglerPath, content, 'utf-8')
  
  log(`  ✅ backend/wrangler.toml`, 'green')
  log(`     - SUPABASE_URL: ${rootEnv.SUPABASE_URL ? '已更新' : '未设置'}`, 'gray')
  log(`     ⚠️  SUPABASE_SERVICE_ROLE_KEY 需在 Cloudflare Dashboard 配置`, 'yellow')
}

/**
 * 主函数
 */
function main() {
  log('\n🔄 开始同步环境变量...\n', 'blue')

  // 检查根目录 .env 是否存在
  if (!existsSync(ROOT_ENV_FILE)) {
    log('❌ 根目录 .env 文件不存在', 'red')
    log('请先从 .env.example 复制：', 'yellow')
    log('  cp .env.example .env', 'gray')
    log('  然后填入真实的配置值\n', 'gray')
    process.exit(1)
  }

  // 读取根目录环境变量（优先读取 .env.local，然后是 .env）
  const rootEnv = parseEnvFile(ROOT_ENV_FILE)
  const rootEnvLocal = parseEnvFile(join(ROOT_DIR, '.env.local'))
  
  // 合并环境变量（.env.local 优先级更高）
  const mergedEnv = { ...rootEnv, ...rootEnvLocal }
  
  // 兼容 VITE_ 前缀的变量（如果存在 VITE_SUPABASE_URL，也作为 SUPABASE_URL）
  if (mergedEnv.VITE_SUPABASE_URL && !mergedEnv.SUPABASE_URL) {
    mergedEnv.SUPABASE_URL = mergedEnv.VITE_SUPABASE_URL
  }
  if (mergedEnv.VITE_SUPABASE_ANON_KEY && !mergedEnv.SUPABASE_ANON_KEY) {
    mergedEnv.SUPABASE_ANON_KEY = mergedEnv.VITE_SUPABASE_ANON_KEY
  }
  
  log('📖 读取根目录环境变量', 'blue')
  log(`   .env: ${Object.keys(rootEnv).length} 个变量`, 'gray')
  log(`   .env.local: ${Object.keys(rootEnvLocal).length} 个变量`, 'gray')
  log(`   合并后: ${Object.keys(mergedEnv).length} 个变量\n`, 'gray')

  // 验证关键配置
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY']
  const missingVars = requiredVars.filter(key => !mergedEnv[key] || mergedEnv[key] === 'your-anon-key-here')
  
  if (missingVars.length > 0) {
    log(`⚠️  缺少关键配置：${missingVars.join(', ')}`, 'yellow')
    log('   某些功能可能不可用\n', 'gray')
  }

  // 同步到各项目
  log('📤 同步到子项目：\n', 'blue')
  
  try {
    syncToWebsite(mergedEnv)
    syncToFrontend(mergedEnv)
    syncToBackend(mergedEnv)
    
    log('\n✅ 环境变量同步完成！\n', 'green')
    log('💡 提示：', 'blue')
    log('   - backend 的 SUPABASE_SERVICE_ROLE_KEY 需在 Cloudflare Dashboard 配置', 'gray')
    log('   - 修改环境变量后记得重启开发服务器\n', 'gray')
  } catch (error) {
    log(`\n❌ 同步失败：${error.message}\n`, 'red')
    process.exit(1)
  }
}

main()
