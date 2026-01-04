#!/usr/bin/env node
/**
 * 组件 README 生成脚本
 * 为所有缺少完善文档的基础组件生成标准化的 README
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_COMPONENTS_DIR = path.join(__dirname, '../frontend/src/components/base')

// 组件信息配置
const COMPONENT_INFO = {
  Icon: {
    title: 'Icon 图标组件',
    description: '一个灵活的图标组件，支持多种图标库和自定义图标。',
    features: [
      '🎨 **多图标库支持** - 支持 Material Design Icons 等',
      '📏 **多种尺寸** - 灵活的尺寸配置',
      '🌈 **颜色定制** - 支持主题色和自定义颜色',
      '🎯 **无障碍** - 符合 WCAG 标准',
      '📦 **零依赖** - 纯原子组件'
    ]
  },
  Spinner: {
    title: 'Spinner 加载动画组件',
    description: '一个简洁的加载动画组件，用于显示加载状态。',
    features: [
      '🎨 **多种样式** - 支持不同的加载动画样式',
      '📏 **多种尺寸** - sm、md、lg 满足不同场景',
      '🌈 **颜色定制** - 支持主题色',
      '⚡ **性能优化** - 使用 CSS 动画，性能优异',
      '📦 **零依赖** - 纯原子组件'
    ]
  },
  Divider: {
    title: 'Divider 分割线组件',
    description: '一个简单的分割线组件，用于分隔内容区域。',
    features: [
      '📏 **方向支持** - 水平和垂直分割线',
      '🎨 **样式定制** - 支持实线、虚线等',
      '📝 **文字分割** - 支持带文字的分割线',
      '📦 **零依赖** - 纯原子组件'
    ]
  },
  Switch: {
    title: 'Switch 开关组件',
    description: '一个开关组件，用于切换两种状态。',
    features: [
      '🎨 **Material Design** - 遵循 MD3 设计规范',
      '📏 **多种尺寸** - sm、md、lg 满足不同场景',
      '🌈 **颜色定制** - 支持主题色',
      '♿ **无障碍** - 完整的键盘和屏幕阅读器支持',
      '📦 **零依赖** - 纯原子组件'
    ]
  },
  Tooltip: {
    title: 'Tooltip 提示框组件',
    description: '一个提示框组件，用于显示额外的信息。',
    features: [
      '📍 **多方向** - 支持上下左右四个方向',
      '⚡ **自动定位** - 智能调整位置避免溢出',
      '🎨 **样式定制** - 支持自定义样式',
      '⏱️ **延迟显示** - 支持延迟显示和隐藏',
      '📦 **零依赖** - 纯原子组件'
    ]
  },
  ProgressBar: {
    title: 'ProgressBar 进度条组件',
    description: '一个进度条组件，用于显示任务进度。',
    features: [
      '📊 **进度显示** - 清晰的进度百分比',
      '🎨 **多种样式** - 支持不同的进度条样式',
      '🌈 **颜色定制** - 支持主题色和自定义颜色',
      '📏 **尺寸定制** - 灵活的高度配置',
      '📦 **零依赖** - 纯原子组件'
    ]
  },
  Dropdown: {
    title: 'Dropdown 下拉菜单组件',
    description: '一个下拉菜单组件，用于显示选项列表。',
    features: [
      '📍 **智能定位** - 自动调整位置避免溢出',
      '⌨️ **键盘导航** - 完整的键盘支持',
      '🎨 **样式定制** - 支持自定义样式',
      '♿ **无障碍** - 符合 WCAG 标准',
      '📦 **零依赖** - 纯原子组件'
    ]
  }
}

/**
 * 生成组件 README 模板
 */
function generateReadmeTemplate(componentName) {
  const info = COMPONENT_INFO[componentName] || {
    title: `${componentName} 组件`,
    description: `一个 ${componentName} 组件。`,
    features: [
      '🎨 **样式定制** - 支持自定义样式',
      '📏 **灵活配置** - 丰富的配置选项',
      '🎯 **无障碍** - 符合 WCAG 标准',
      '📦 **零依赖** - 纯原子组件'
    ]
  }

  return `# ${info.title}

${info.description}

## ✨ 特性

${info.features.map(f => `- ${f}`).join('\n')}

## 📦 安装

\`\`\`typescript
import { ${componentName} } from '@/components'
\`\`\`

## 🎯 基础用法

### 默认用法

\`\`\`vue
<script setup lang="ts">
import { ${componentName} } from '@/components'
</script>

<template>
  <${componentName} />
</template>
\`\`\`

## 📋 API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| - | - | - | 待补充 |

### Emits

| 事件名 | 参数 | 说明 |
|--------|------|------|
| - | - | 待补充 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| \`default\` | 默认内容 |

## 🎨 样式变量

组件使用 CSS 变量，可以通过覆盖变量来自定义样式。

## 💡 使用场景

待补充

## ⚠️ 注意事项

1. 这是基础组件，不包含业务逻辑
2. 支持所有标准的 HTML 属性传递

## 🔗 相关组件

待补充

## 📝 更新日志

- **v1.0.0** - 初始版本

---

**组件类型**: 基础组件（原子级）  
**最后更新**: 2025-01-05
`
}

/**
 * 检查组件是否需要生成 README
 */
function needsReadme(componentPath) {
  const readmePath = path.join(componentPath, 'README.md')
  
  if (!fs.existsSync(readmePath)) {
    return true
  }
  
  const content = fs.readFileSync(readmePath, 'utf-8')
  // 如果包含 TODO 或内容很少，认为需要更新
  return content.includes('TODO') || content.length < 500
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始生成组件 README...\n')
  
  const components = fs.readdirSync(BASE_COMPONENTS_DIR)
    .filter(name => {
      const componentPath = path.join(BASE_COMPONENTS_DIR, name)
      return fs.statSync(componentPath).isDirectory()
    })
  
  let generated = 0
  let skipped = 0
  
  for (const componentName of components) {
    const componentPath = path.join(BASE_COMPONENTS_DIR, componentName)
    const readmePath = path.join(componentPath, 'README.md')
    
    if (needsReadme(componentPath)) {
      const template = generateReadmeTemplate(componentName)
      fs.writeFileSync(readmePath, template, 'utf-8')
      console.log(`✅ 生成: ${componentName}/README.md`)
      generated++
    } else {
      console.log(`⏭️  跳过: ${componentName}/README.md (已存在完善文档)`)
      skipped++
    }
  }
  
  console.log(`\n📊 统计:`)
  console.log(`   生成: ${generated} 个`)
  console.log(`   跳过: ${skipped} 个`)
  console.log(`   总计: ${components.length} 个`)
  console.log(`\n✨ 完成！`)
}

main()
