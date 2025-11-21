#!/usr/bin/env bun
/**
 * 智能 Lint 脚本
 * 1. 运行 prettier 格式化
 * 2. 运行 ESLint 检查和自动修复
 * 3. 运行 Stylelint 检查和自动修复（如果存在）
 * 4. 显示详细的修复结果
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.cyan}▶ 运行: ${command} ${args.join(' ')}${colors.reset}`)
    
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, code })
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

async function main() {
  log('\n🔍 开始代码检查和修复流程\n', 'bright')
  
  const results = {
    prettier: { success: false, name: 'Prettier 格式化' },
    eslint: { success: false, name: 'ESLint 检查修复' },
    stylelint: { success: false, name: 'Stylelint 检查修复' }
  }

  // 1. Prettier 格式化
  log('━'.repeat(60), 'cyan')
  log('步骤 1/3: Prettier 格式化', 'bright')
  log('━'.repeat(60), 'cyan')
  
  const prettierResult = await runCommand(
    'bunx',
    ['prettier', '--write', '**/*.{js,ts,vue,css,md,json}', '--ignore-path', '.gitignore'],
    projectRoot
  )
  results.prettier.success = prettierResult.success

  // 2. ESLint 检查和修复
  log('\n' + '━'.repeat(60), 'cyan')
  log('步骤 2/3: ESLint 检查和修复', 'bright')
  log('━'.repeat(60), 'cyan')
  
  const eslintResult = await runCommand(
    'bunx',
    ['turbo', 'run', 'lint'],
    projectRoot
  )
  results.eslint.success = eslintResult.success

  // 3. 检查是否需要运行 Stylelint（仅 frontend）
  const frontendPath = resolve(projectRoot, 'frontend')
  const hasStylelint = existsSync(resolve(frontendPath, 'src'))
  
  if (hasStylelint) {
    log('\n' + '━'.repeat(60), 'cyan')
    log('步骤 3/3: Stylelint 检查和修复', 'bright')
    log('━'.repeat(60), 'cyan')
    
    const stylelintResult = await runCommand(
      'bun',
      ['run', 'stylelint'],
      frontendPath
    )
    results.stylelint.success = stylelintResult.success
  } else {
    results.stylelint.success = true // 跳过
  }

  // 显示总结
  log('\n' + '═'.repeat(60), 'bright')
  log('📊 修复结果汇总', 'bright')
  log('═'.repeat(60), 'bright')

  let allSuccess = true
  for (const [key, result] of Object.entries(results)) {
    if (key === 'stylelint' && !hasStylelint) continue
    
    const icon = result.success ? '✅' : '❌'
    const color = result.success ? 'green' : 'red'
    const status = result.success ? '成功' : '失败'
    
    log(`${icon} ${result.name}: ${status}`, color)
    
    if (!result.success) {
      allSuccess = false
    }
  }

  log('═'.repeat(60), 'bright')

  if (allSuccess) {
    log('\n🎉 所有代码检查和修复完成！', 'green')
    process.exit(0)
  } else {
    log('\n⚠️  部分检查失败，请查看上方错误信息', 'yellow')
    process.exit(1)
  }
}

main().catch((err) => {
  log(`\n❌ 脚本执行出错: ${err.message}`, 'red')
  process.exit(1)
})
