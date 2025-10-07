/**
 * AcuityBookmarks 代码质量自动化增强脚本
 *
 * 目标：最大化 lint:fix 和 stylelint:fix 的自动修复能力
 * 原则：保留人工决策（设计/安全），自动化格式/语法/最佳实践
 *
 * 使用方法：
 * bun scripts/enhance-autofix.js
 *
 * 功能：
 * 1. 智能代码格式化和语法优化
 * 2. 自动导入整理和模块清理
 * 3. TypeScript 类型优化
 * 4. Vue SFC 结构标准化
 * 5. CSS/SCSS 属性排序和格式化
 * 6. 性能优化建议应用
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

class AutoFixEnhancer {
  constructor() {
    this.rootDir = process.cwd()
    this.stats = {
      processed: 0,
      fixed: 0,
      warnings: 0,
      errors: 0
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString().slice(11, 19)
    const colors = {
      info: '\x1b[36m', // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
      reset: '\x1b[0m'
    }

    console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`)
  }

  async runCommand(command, description) {
    try {
      this.log(`执行: ${description}`, 'info')
      const output = execSync(command, {
        encoding: 'utf8',
        cwd: this.rootDir,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      if (output.trim()) {
        this.log(`输出: ${output.trim()}`, 'success')
      }
      return { success: true, output }
    } catch (error) {
      const errorOutput = error.stderr || error.stdout || error.message
      this.log(`错误: ${errorOutput}`, 'error')
      return { success: false, error: errorOutput }
    }
  }

  async enhancePrettier() {
    this.log('🎨 优化 Prettier 格式化...', 'info')

    // 1. 格式化所有支持的文件
    await this.runCommand(
      'bunx prettier --write "**/*.{js,ts,vue,css,scss,json,md}" --ignore-path .gitignore',
      'Prettier 全局格式化'
    )

    // 2. 特殊处理 TypeScript 配置文件
    await this.runCommand(
      'bunx prettier --write "**/*.{json,jsonc}" --parser json',
      'JSON 配置文件格式化'
    )
  }

  async enhanceStylelint() {
    this.log('💅 优化 Stylelint 修复...', 'info')

    // 1. 基础 CSS/SCSS 文件修复
    await this.runCommand(
      'bunx stylelint "frontend/src/**/*.{css,scss}" --cache --fix',
      'CSS/SCSS 文件自动修复'
    )

    // 2. Vue 单文件组件样式修复
    await this.runCommand(
      'bunx stylelint "frontend/src/**/*.vue" --cache --fix',
      'Vue SFC 样式自动修复'
    )

    // 3. 全局样式文件特别处理
    const globalStyleFiles = [
      'frontend/src/assets/main.css',
      'frontend/src/assets/fonts.css',
      'frontend/src/assets/smart-fonts.css'
    ]

    for (const file of globalStyleFiles) {
      if (existsSync(join(this.rootDir, file))) {
        await this.runCommand(
          `bunx stylelint "${file}" --fix`,
          `全局样式文件修复: ${file}`
        )
      }
    }
  }

  async enhanceESLint() {
    this.log('🔧 优化 ESLint 修复...', 'info')

    // 1. 前端代码修复（最严格）
    await this.runCommand(
      'bunx eslint frontend/src --cache --fix --max-warnings 0',
      '前端代码自动修复'
    )

    // 2. 后端代码修复
    await this.runCommand(
      'bunx eslint backend --cache --fix',
      '后端代码自动修复'
    )

    // 3. 配置文件修复
    await this.runCommand(
      'bunx eslint "*.{js,ts,mjs,cjs}" --cache --fix',
      '配置文件自动修复'
    )

    // 4. 脚本文件修复
    await this.runCommand(
      'bunx eslint "scripts/**/*.{js,ts,mjs,cjs}" --cache --fix',
      '脚本文件自动修复'
    )
  }

  async enhanceTypeScript() {
    this.log('📝 优化 TypeScript 类型检查...', 'info')

    // 1. 前端类型检查
    const frontendTypeCheck = await this.runCommand(
      'cd frontend && bunx vue-tsc --noEmit',
      '前端 TypeScript 类型检查'
    )

    if (!frontendTypeCheck.success) {
      this.log('TypeScript 类型错误需要人工处理', 'warning')
      this.stats.warnings++
    }

    // 2. 后端类型检查（如果有 tsconfig.json）
    if (existsSync(join(this.rootDir, 'backend/tsconfig.json'))) {
      await this.runCommand(
        'cd backend && bunx tsc --noEmit',
        '后端 TypeScript 类型检查'
      )
    }
  }

  async enhanceImports() {
    this.log('📦 优化导入和模块结构...', 'info')

    // 使用 ESLint 的导入排序规则
    await this.runCommand(
      'bunx eslint "frontend/src/**/*.{ts,vue}" --cache --fix --rule "sort-imports: warn"',
      '导入语句自动排序'
    )

    // Vue 组件特殊优化
    await this.runCommand(
      'bunx eslint "frontend/src/components/**/*.vue" --cache --fix',
      'Vue 组件代码优化'
    )
  }

  async optimizePerformance() {
    this.log('⚡ 应用性能优化修复...', 'info')

    // 应用所有性能相关的 ESLint 规则
    const performanceRules = [
      'prefer-const',
      'prefer-template',
      'prefer-spread',
      'prefer-arrow-callback',
      'no-unnecessary-condition',
      'prefer-optional-chain',
      'prefer-nullish-coalescing'
    ]

    for (const rule of performanceRules) {
      await this.runCommand(
        `bunx eslint "frontend/src/**/*.{ts,vue}" --cache --fix --rule "${rule}: warn"`,
        `应用性能规则: ${rule}`
      )
    }
  }

  async validateResults() {
    this.log('✅ 验证修复结果...', 'info')

    // 1. 最终 lint 检查
    const lintResult = await this.runCommand(
      'bunx eslint . --cache --max-warnings 0',
      '最终代码质量验证'
    )

    // 2. 最终 stylelint 检查
    const stylelintResult = await this.runCommand(
      'bunx stylelint "frontend/src/**/*.{vue,css,scss}" --cache',
      '最终样式质量验证'
    )

    // 3. 类型检查
    const typeResult = await this.runCommand(
      'bunx vue-tsc --noEmit',
      '最终类型检查'
    )

    return {
      lint: lintResult.success,
      style: stylelintResult.success,
      types: typeResult.success
    }
  }

  async run() {
    console.log('🚀 AcuityBookmarks 代码质量自动化增强开始...\n')

    const startTime = Date.now()

    try {
      // 按优先级顺序执行增强步骤
      await this.enhancePrettier()
      await this.enhanceStylelint()
      await this.enhanceESLint()
      await this.enhanceImports()
      await this.optimizePerformance()
      await this.enhanceTypeScript()

      // 验证结果
      const validation = await this.validateResults()

      const endTime = Date.now()
      const duration = ((endTime - startTime) / 1000).toFixed(2)

      console.log('\n📊 增强完成统计:')
      console.log(`⏱️  总耗时: ${duration}秒`)
      console.log(`✅ Lint 检查: ${validation.lint ? '通过' : '需要人工处理'}`)
      console.log(`🎨 样式检查: ${validation.style ? '通过' : '需要人工处理'}`)
      console.log(`📝 类型检查: ${validation.types ? '通过' : '需要人工处理'}`)

      if (validation.lint && validation.style && validation.types) {
        this.log('🎉 所有代码质量检查通过！', 'success')
      } else {
        this.log(
          '⚠️  部分检查需要人工处理，这通常涉及设计决策或潜在漏洞',
          'warning'
        )
      }
    } catch (error) {
      this.log(`增强过程出错: ${error.message}`, 'error')
      throw error
    }
  }
}

// 执行增强脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const enhancer = new AutoFixEnhancer()
  enhancer.run().catch(console.error)
}

export default AutoFixEnhancer
