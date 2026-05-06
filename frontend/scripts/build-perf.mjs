#!/usr/bin/env node
/**
 * 构建性能监控脚本
 * 
 * 监控构建时间和性能指标
 */

import { execSync } from 'child_process'
import { performance } from 'perf_hooks'

/**
 * 格式化时间
 */
function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * 运行构建并监控性能
 */
async function runBuildWithPerfMonitoring() {
  console.log('🚀 开始构建性能监控...\n')
  
  const startTime = performance.now()
  
  try {
    // 运行类型检查
    console.log('📝 类型检查...')
    const typecheckStart = performance.now()
    execSync('vue-tsc -b', { stdio: 'inherit' })
    const typecheckTime = performance.now() - typecheckStart
    console.log(`✅ 类型检查完成: ${formatTime(typecheckTime)}\n`)
    
    // 运行构建
    console.log('📦 构建...')
    const buildStart = performance.now()
    execSync('vite build', { stdio: 'inherit' })
    const buildTime = performance.now() - buildStart
    console.log(`✅ 构建完成: ${formatTime(buildTime)}\n`)
    
    const totalTime = performance.now() - startTime
    
    // 打印性能报告
    console.log('📊 性能报告:')
    console.log(`   类型检查: ${formatTime(typecheckTime)} (${((typecheckTime / totalTime) * 100).toFixed(1)}%)`)
    console.log(`   构建: ${formatTime(buildTime)} (${((buildTime / totalTime) * 100).toFixed(1)}%)`)
    console.log(`   总时间: ${formatTime(totalTime)}`)
    
    // 性能建议
    if (totalTime > 60000) {
      console.log('\n⚠️  构建时间较长，建议：')
      console.log('   1. 使用 FAST_MINIFY=1 启用 esbuild 压缩')
      console.log('   2. 检查是否有大型依赖可以按需加载')
      console.log('   3. 考虑使用增量构建（build:watch）')
    }
    
  } catch (error) {
    console.error('❌ 构建失败:', error.message)
    process.exit(1)
  }
}

runBuildWithPerfMonitoring()
