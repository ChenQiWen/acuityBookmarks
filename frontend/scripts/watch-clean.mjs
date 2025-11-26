#!/usr/bin/env bun
/**
 * 监听 dist 目录变化，自动运行清理脚本
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 修复：监听根目录的dist（vite配置输出到../../dist）
const distDir = path.resolve(__dirname, '../../dist')
const cleanScript = path.resolve(__dirname, 'clean-dist.cjs')

console.log('👀 监听 dist 目录变化...')
console.log(`📁 目标目录: ${distDir}`)

let timeout = null
let isProcessing = false

const runClean = () => {
  if (isProcessing) return
  isProcessing = true
  
  console.log('🧹 检测到构建完成，运行清理脚本...')
  try {
    execSync(`bun ${cleanScript}`, { stdio: 'inherit' })
    console.log('✅ 清理完成\n')
  } catch (error) {
    console.error('❌ 清理失败:', error.message)
  } finally {
    isProcessing = false
  }
}

// 监听 dist 目录
const watcher = fs.watch(distDir, { recursive: true }, (eventType) => {
  // 只在文件创建/修改时触发，忽略删除事件
  if (eventType === 'change' || eventType === 'rename') {
    // 防抖：500ms 内的多次变更只触发一次
    clearTimeout(timeout)
    timeout = setTimeout(runClean, 500)
  }
})

// 首次运行清理（处理已存在的构建）
setTimeout(() => {
  if (fs.existsSync(path.join(distDir, 'src'))) {
    console.log('🔧 检测到现有构建，运行初始清理...')
    runClean()
  }
}, 2000)

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 停止监听')
  watcher.close()
  process.exit(0)
})
