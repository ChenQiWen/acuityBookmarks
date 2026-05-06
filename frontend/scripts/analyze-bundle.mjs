#!/usr/bin/env node
/**
 * Bundle 分析脚本
 * 
 * 分析构建产物的大小和组成
 */

import { readdirSync, statSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DIST_DIR = join(__dirname, '../dist')

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 获取目录下所有文件
 */
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir)
  
  files.forEach(file => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)
    
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList)
    } else {
      fileList.push({
        path: filePath.replace(DIST_DIR + '/', ''),
        size: stat.size,
        ext: extname(file)
      })
    }
  })
  
  return fileList
}

/**
 * 分析 Bundle
 */
function analyzeBundle() {
  console.log('📊 分析 Bundle 大小...\n')
  
  const files = getAllFiles(DIST_DIR)
  
  // 按类型分组
  const groups = {
    js: { files: [], totalSize: 0 },
    css: { files: [], totalSize: 0 },
    html: { files: [], totalSize: 0 },
    images: { files: [], totalSize: 0 },
    fonts: { files: [], totalSize: 0 },
    wasm: { files: [], totalSize: 0 },
    other: { files: [], totalSize: 0 }
  }
  
  files.forEach(file => {
    let group = 'other'
    
    if (file.ext === '.js') group = 'js'
    else if (file.ext === '.css') group = 'css'
    else if (file.ext === '.html') group = 'html'
    else if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'].includes(file.ext)) group = 'images'
    else if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(file.ext)) group = 'fonts'
    else if (file.ext === '.wasm') group = 'wasm'
    
    groups[group].files.push(file)
    groups[group].totalSize += file.size
  })
  
  // 打印统计
  let totalSize = 0
  
  Object.entries(groups).forEach(([type, data]) => {
    if (data.files.length === 0) return
    
    console.log(`\n📦 ${type.toUpperCase()} 文件 (${data.files.length} 个)`)
    console.log(`   总大小: ${formatSize(data.totalSize)}`)
    
    // 显示最大的 5 个文件
    const topFiles = data.files
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
    
    topFiles.forEach(file => {
      console.log(`   - ${file.path}: ${formatSize(file.size)}`)
    })
    
    totalSize += data.totalSize
  })
  
  console.log(`\n📊 总大小: ${formatSize(totalSize)}`)
  
  // 检查大文件
  const largeFiles = files
    .filter(f => f.size > 500 * 1024) // > 500KB
    .sort((a, b) => b.size - a.size)
  
  if (largeFiles.length > 0) {
    console.log(`\n⚠️  大文件警告 (> 500KB):`)
    largeFiles.forEach(file => {
      console.log(`   - ${file.path}: ${formatSize(file.size)}`)
    })
  }
  
  // 检查 vendor chunks
  const vendorChunks = files.filter(f => f.path.includes('vendor-'))
  if (vendorChunks.length > 0) {
    console.log(`\n📦 Vendor Chunks (${vendorChunks.length} 个):`)
    vendorChunks
      .sort((a, b) => b.size - a.size)
      .forEach(file => {
        console.log(`   - ${file.path}: ${formatSize(file.size)}`)
      })
  }
}

try {
  analyzeBundle()
} catch (error) {
  console.error('❌ 分析失败:', error.message)
  process.exit(1)
}
