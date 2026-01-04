#!/usr/bin/env bun
/**
 * 修复 i18n 键名中的点号
 * 
 * Chrome 扩展的 i18n 消息键名只允许使用 ASCII 字母、数字、下划线和连字符
 * 不允许使用点号（.）
 * 
 * 这个脚本会：
 * 1. 将所有翻译文件中的点号（.）替换为下划线（_）
 * 2. 更新所有代码文件中的 i18n 键引用
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

/**
 * 修复翻译文件中的键名
 */
async function fixLocaleFiles(): Promise<Map<string, string>> {
  const localesDir = join(process.cwd(), 'public/_locales')
  const keyMapping = new Map<string, string>()
  
  try {
    const entries = await readdir(localesDir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const messagesPath = join(localesDir, entry.name, 'messages.json')
        
        try {
          const content = await readFile(messagesPath, 'utf-8')
          const messages = JSON.parse(content)
          const newMessages: Record<string, { message: string; description?: string }> = {}
          
          // 替换键名中的点号
          for (const [key, value] of Object.entries(messages)) {
            if (key.includes('.')) {
              const newKey = key.replace(/\./g, '_')
              keyMapping.set(key, newKey)
              newMessages[newKey] = value
              console.log(`  ${entry.name}: ${key} → ${newKey}`)
            } else {
              newMessages[key] = value
            }
          }
          
          // 写回文件
          await writeFile(
            messagesPath,
            JSON.stringify(newMessages, null, 2) + '\n',
            'utf-8'
          )
          
          console.log(`✅ 已更新 ${entry.name}/messages.json`)
        } catch (error) {
          console.error(`❌ 无法处理 ${entry.name}/messages.json:`, error)
        }
      }
    }
  } catch (error) {
    console.error('❌ 读取 _locales 目录失败:', error)
  }
  
  return keyMapping
}

/**
 * 扫描目录获取所有代码文件
 */
async function scanCodeFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const excludedDirs = ['node_modules', 'dist', '.turbo', 'public/_locales']
  
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        if (!excludedDirs.some(excluded => fullPath.includes(excluded))) {
          files.push(...await scanCodeFiles(fullPath))
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
          files.push(fullPath)
        }
      }
    }
  } catch (_error) {
    console.error(`扫描目录失败: ${dir}`)
  }
  
  return files
}

/**
 * 更新代码文件中的 i18n 键引用
 */
async function updateCodeFiles(keyMapping: Map<string, string>): Promise<void> {
  const srcDir = join(process.cwd(), 'src')
  const codeFiles = await scanCodeFiles(srcDir)
  
  console.log(`\n📝 扫描到 ${codeFiles.length} 个代码文件`)
  
  let updatedCount = 0
  
  for (const filePath of codeFiles) {
    try {
      let content = await readFile(filePath, 'utf-8')
      let hasChanges = false
      
      // 替换所有旧键名
      for (const [oldKey, newKey] of keyMapping.entries()) {
        // 匹配 t('old.key') 或 t("old.key")
        const regex1 = new RegExp(`t\\(['"]${oldKey.replace(/\./g, '\\.')}['"]\\)`, 'g')
        if (regex1.test(content)) {
          content = content.replace(regex1, `t('${newKey}')`)
          hasChanges = true
        }
        
        // 匹配 chrome.i18n.getMessage('old.key')
        const regex2 = new RegExp(`chrome\\.i18n\\.getMessage\\(['"]${oldKey.replace(/\./g, '\\.')}['"]`, 'g')
        if (regex2.test(content)) {
          content = content.replace(regex2, `chrome.i18n.getMessage('${newKey}'`)
          hasChanges = true
        }
      }
      
      if (hasChanges) {
        await writeFile(filePath, content, 'utf-8')
        updatedCount++
        console.log(`✅ 已更新 ${filePath.replace(process.cwd(), '')}`)
      }
    } catch (error) {
      console.error(`❌ 无法处理 ${filePath}:`, error)
    }
  }
  
  console.log(`\n✅ 共更新了 ${updatedCount} 个代码文件`)
}

/**
 * 主函数
 */
async function main() {
  console.log('🔧 开始修复 i18n 键名...\n')
  
  // 1. 修复翻译文件
  console.log('📚 修复翻译文件中的键名...\n')
  const keyMapping = await fixLocaleFiles()
  
  console.log(`\n✅ 共替换了 ${keyMapping.size} 个键名`)
  
  // 2. 更新代码文件
  console.log('\n📝 更新代码文件中的 i18n 键引用...\n')
  await updateCodeFiles(keyMapping)
  
  console.log('\n🎉 修复完成！')
  console.log('\n⚠️  重要提示:')
  console.log('  1. 请运行 bun run i18n:validate 验证翻译文件')
  console.log('  2. 请运行 bun run typecheck 检查类型错误')
  console.log('  3. 请运行 bun run build 重新构建扩展')
  console.log('  4. 请测试功能是否正常\n')
}

main().catch(console.error)
