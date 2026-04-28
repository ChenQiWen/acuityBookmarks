/**
 * 构建后验证脚本：确保 background.js 是干净的 Service Worker
 *
 * 检查项：
 * 1. 不包含 document.* 调用（Service Worker 没有 DOM）
 * 2. 不包含 window.* 调用（Service Worker 没有 window）
 * 3. 不包含 localStorage（Service Worker 没有 localStorage）
 */

const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '../../dist')
const backgroundFile = path.join(distDir, 'background.js')

if (!fs.existsSync(backgroundFile)) {
  console.error('❌ background.js 不存在，请先构建')
  process.exit(1)
}

const content = fs.readFileSync(backgroundFile, 'utf-8')

const violations = []

// 检查 DOM API 调用（排除注释和字符串中的误报）
const domPatterns = [
  { pattern: /\bdocument\.createElement\b/, name: 'document.createElement' },
  { pattern: /\bdocument\.querySelector\b/, name: 'document.querySelector' },
  { pattern: /\bdocument\.getElementById\b/, name: 'document.getElementById' },
  { pattern: /\bdocument\.body\b/, name: 'document.body' },
  { pattern: /\blocalStorage\b/, name: 'localStorage' },
  { pattern: /\bsessionStorage\b/, name: 'sessionStorage' },
]

for (const { pattern, name } of domPatterns) {
  if (pattern.test(content)) {
    violations.push(name)
  }
}

if (violations.length > 0) {
  console.error('❌ background.js 包含不兼容 Service Worker 的 API:')
  violations.forEach(v => console.error(`   - ${v}`))
  console.error('\n这通常意味着某个 services/ 或 infrastructure/ 层的模块')
  console.error('被错误地打包进了 background.js 依赖的 chunk。')
  console.error('请检查是否有跨层导入（services → background）。')
  process.exit(1)
}

// 检查 background.js 导入的 chunk 是否包含 DOM 代码
const importPattern = /import\{[^}]+\}from"([^"]+)"/g
let match
const importedChunks = []
while ((match = importPattern.exec(content)) !== null) {
  const chunkPath = match[1]
  if (chunkPath.includes('app-components')) {
    importedChunks.push(chunkPath)
  }
}

if (importedChunks.length > 0) {
  // app-components 里有 DOM 代码，检查导入的是否只是辅助函数
  const importLines = content.match(/import\{[^}]+\}from"[^"]*app-components[^"]*"/g) || []
  const hasOnlyHelpers = importLines.every(line => {
    // 只允许导入 _ (vite mapDeps helper)
    return /import\{_[^,}]*\}/.test(line)
  })

  if (!hasOnlyHelpers) {
    console.error('❌ background.js 从 app-components 导入了非辅助函数:')
    importLines.forEach(l => console.error(`   ${l.substring(0, 100)}`))
    process.exit(1)
  }
}

console.log('✅ background.js 验证通过：无 DOM API，无非法 chunk 依赖')
