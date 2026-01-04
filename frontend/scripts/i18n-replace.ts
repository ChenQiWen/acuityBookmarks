#!/usr/bin/env bun
/**
 * 国际化文案自动替换工具
 * 
 * 功能：
 * 1. 读取 i18n-report.json
 * 2. 交互式选择要替换的文案
 * 3. 自动生成翻译键
 * 4. 更新代码文件
 * 5. 更新语言包文件
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import * as readline from 'readline'

interface ExtractedText {
  text: string
  file: string
  line: number
  suggestedKey: string
}

interface ReplacementPlan {
  text: string
  key: string
  files: Array<{
    path: string
    lines: number[]
  }>
}

/**
 * 读取报告文件
 */
async function loadReport(): Promise<ExtractedText[]> {
  const reportPath = join(process.cwd(), 'i18n-report.json')
  const content = await readFile(reportPath, 'utf-8')
  const report = JSON.parse(content)
  return report.hardcodedTexts
}

/**
 * 交互式选择文案
 */
async function selectTexts(texts: ExtractedText[]): Promise<ExtractedText[]> {
  console.log('\n📝 发现 %d 条硬编码文案\n', texts.length)
  console.log('选择处理方式:')
  console.log('  1. 处理前 50 条（推荐）')
  console.log('  2. 处理前 100 条')
  console.log('  3. 处理全部（谨慎！）')
  console.log('  4. 手动选择范围')
  console.log('  0. 退出\n')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('请选择 (0-4): ', (answer) => {
      rl.close()

      switch (answer.trim()) {
        case '1':
          resolve(texts.slice(0, 50))
          break
        case '2':
          resolve(texts.slice(0, 100))
          break
        case '3':
          console.log('\n⚠️  警告：将处理全部 %d 条文案，这可能需要很长时间！', texts.length)
          resolve(texts)
          break
        case '4':
          // TODO: 实现自定义范围
          console.log('\n暂不支持，使用前 50 条')
          resolve(texts.slice(0, 50))
          break
        default:
          console.log('\n👋 已取消')
          process.exit(0)
      }
    })
  })
}

/**
 * 生成替换计划
 */
function generateReplacementPlan(texts: ExtractedText[]): ReplacementPlan[] {
  const planMap = new Map<string, ReplacementPlan>()

  texts.forEach(item => {
    if (!planMap.has(item.text)) {
      planMap.set(item.text, {
        text: item.text,
        key: item.suggestedKey,
        files: []
      })
    }

    const plan = planMap.get(item.text)!
    const existingFile = plan.files.find(f => f.path === item.file)

    if (existingFile) {
      existingFile.lines.push(item.line)
    } else {
      plan.files.push({
        path: item.file,
        lines: [item.line]
      })
    }
  })

  return Array.from(planMap.values())
}

/**
 * 更新语言包
 */
async function updateLocaleFiles(plans: ReplacementPlan[]): Promise<void> {
  const locales = ['zh_CN', 'en', 'ja', 'ko', 'ar', 'zh_TW']

  for (const locale of locales) {
    const messagesPath = join(process.cwd(), `public/_locales/${locale}/messages.json`)

    try {
      const content = await readFile(messagesPath, 'utf-8')
      const messages = JSON.parse(content)

      // 添加新的翻译键
      plans.forEach(plan => {
        if (!(plan.key in messages)) {
          messages[plan.key] = {
            message: locale === 'zh_CN' ? plan.text : `[TODO: ${plan.text}]`,
            description: `自动提取 - 原文: ${plan.text}`
          }
        }
      })

      // 写回文件
      await writeFile(
        messagesPath,
        JSON.stringify(messages, null, 2) + '\n',
        'utf-8'
      )

      console.log(`✅ 已更新 ${locale}/messages.json`)
    } catch {
      console.warn(`⚠️  无法更新 ${locale}/messages.json`)
    }
  }
}

/**
 * 替换代码中的文案
 */
async function replaceInCode(plans: ReplacementPlan[]): Promise<void> {
  const fileMap = new Map<string, ReplacementPlan[]>()

  // 按文件分组
  plans.forEach(plan => {
    plan.files.forEach(file => {
      const existing = fileMap.get(file.path) || []
      existing.push(plan)
      fileMap.set(file.path, existing)
    })
  })

  // 处理每个文件
  for (const [filePath, filePlans] of fileMap.entries()) {
    try {
      const fullPath = join(process.cwd(), filePath)
      const content = await readFile(fullPath, 'utf-8')
      let newContent = content

      // 检测文件类型
      const isVue = filePath.endsWith('.vue')
      const isTs = filePath.endsWith('.ts')

      // 添加 import（如果需要）
      if (isTs && !content.includes("from '@/utils/i18n-helpers'")) {
        newContent = `import { t } from '@/utils/i18n-helpers'\n\n${newContent}`
      }

      if (isVue && !content.includes("from '@/utils/i18n-helpers'")) {
        // 在 <script setup> 中添加 import
        newContent = newContent.replace(
          /<script setup.*?>/,
          (match) => `${match}\nimport { t } from '@/utils/i18n-helpers'`
        )
      }

      // 替换文案
      filePlans.forEach(plan => {
        // 简单替换（可能需要更智能的逻辑）
        const regex = new RegExp(`['"]${escapeRegex(plan.text)}['"]`, 'g')
        newContent = newContent.replace(regex, `t('${plan.key}')`)
      })

      // 写回文件
      await writeFile(fullPath, newContent, 'utf-8')
      console.log(`✅ 已更新 ${filePath}`)
    } catch {
      console.warn(`⚠️  无法更新 ${filePath}`)
    }
  }
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 生成替换预览
 */
function showPreview(plans: ReplacementPlan[]): void {
  console.log('\n📋 替换预览:\n')

  plans.slice(0, 10).forEach((plan, index) => {
    console.log(`${index + 1}. "${plan.text}"`)
    console.log(`   键: ${plan.key}`)
    console.log(`   文件数: ${plan.files.length}`)
    console.log(`   总出现次数: ${plan.files.reduce((sum, f) => sum + f.lines.length, 0)}`)
    console.log()
  })

  if (plans.length > 10) {
    console.log(`... 还有 ${plans.length - 10} 条\n`)
  }
}

/**
 * 确认执行
 */
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

/**
 * 主函数
 */
async function main() {
  console.log('🔄 国际化文案自动替换工具\n')

  // 1. 加载报告
  console.log('📖 加载 i18n-report.json...')
  const texts = await loadReport()

  if (texts.length === 0) {
    console.log('❌ 没有发现硬编码文案')
    return
  }

  // 2. 选择要处理的文案
  const selected = await selectTexts(texts)
  console.log(`\n✅ 已选择 ${selected.length} 条文案\n`)

  // 3. 生成替换计划
  console.log('📝 生成替换计划...')
  const plans = generateReplacementPlan(selected)
  console.log(`✅ 生成了 ${plans.length} 个替换计划\n`)

  // 4. 显示预览
  showPreview(plans)

  // 5. 确认执行
  const shouldProceed = await confirm('⚠️  确定要执行替换吗？这将修改代码文件！')

  if (!shouldProceed) {
    console.log('\n👋 已取消')
    return
  }

  // 6. 更新语言包
  console.log('\n📚 更新语言包文件...')
  await updateLocaleFiles(plans)

  // 7. 替换代码
  console.log('\n🔧 替换代码中的文案...')
  await replaceInCode(plans)

  console.log('\n✅ 替换完成！')
  console.log('\n⚠️  重要提示:')
  console.log('  1. 请检查修改的文件，确保替换正确')
  console.log('  2. 运行 bun run typecheck 检查类型错误')
  console.log('  3. 运行 bun run lint 检查代码规范')
  console.log('  4. 测试功能是否正常')
  console.log('  5. 提交前请仔细 review 代码变更\n')
}

main().catch(console.error)
