#!/usr/bin/env node
/**
 * 复合组件 README 生成脚本
 * 为所有复合组件生成标准化的 README
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const COMPOSITE_COMPONENTS_DIR = path.join(__dirname, '../frontend/src/components/composite')

// 复合组件信息配置
const COMPONENT_INFO = {
  Alert: {
    title: 'Alert 警告提示组件',
    description: '一个警告提示组件，用于向用户显示重要信息、成功、警告或错误消息。',
    features: [
      '🎨 **多种样式** - 支持 filled、outlined、soft 三种样式',
      '🌈 **丰富颜色** - 6 种语义化颜色（info、success、warning、error 等）',
      '📏 **三种尺寸** - sm、md、lg 满足不同场景',
      '🔧 **图标支持** - 自动匹配语义化图标',
      '📦 **组合组件** - 由 Icon + 内容区域组成'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '成功提示',
        code: `<Alert color="success">
  操作成功！
</Alert>`
      },
      {
        title: '错误提示',
        code: `<Alert color="error">
  操作失败，请重试
</Alert>`
      }
    ]
  },
  Card: {
    title: 'Card 卡片组件',
    description: '一个卡片容器组件，用于组织和展示相关内容。',
    features: [
      '🎨 **灵活布局** - 支持标题、内容、操作区域',
      '🖼️ **图片支持** - 可包含图片或图标',
      '🔧 **可交互** - 支持点击、悬停等交互',
      '📦 **组合组件** - 可能包含 Icon 等基础组件'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '基础卡片',
        code: `<Card title="卡片标题">
  <p>卡片内容</p>
</Card>`
      }
    ]
  },
  Dialog: {
    title: 'Dialog 对话框组件',
    description: '一个对话框组件，用于显示模态内容和用户交互。',
    features: [
      '🎨 **Material Design** - 遵循 MD3 设计规范',
      '⌨️ **键盘支持** - ESC 关闭、Tab 焦点管理',
      '🔒 **焦点锁定** - 防止焦点逃逸',
      '📱 **响应式** - 适配不同屏幕尺寸',
      '📦 **组合组件** - 由 Button + Card + Icon 组成'
    ],
    dependencies: ['Button', 'Card', 'Icon'],
    useCases: [
      {
        title: '确认对话框',
        code: `<Dialog
  :show="showDialog"
  title="确认删除"
  @confirm="handleConfirm"
  @cancel="handleCancel"
>
  <p>确定要删除这个项目吗？</p>
</Dialog>`
      }
    ]
  },
  EmptyState: {
    title: 'EmptyState 空状态组件',
    description: '一个空状态组件，用于展示无数据、筛选无结果等空状态。',
    features: [
      '🎨 **友好提示** - 清晰的空状态说明',
      '🖼️ **图标支持** - 可自定义图标',
      '🔧 **操作引导** - 支持添加操作按钮',
      '📦 **组合组件** - 由 Icon + 标题 + 描述组成'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '无数据状态',
        code: `<EmptyState
  icon="icon-folder"
  title="暂无数据"
  description="还没有添加任何内容"
>
  <Button @click="handleAdd">添加内容</Button>
</EmptyState>`
      }
    ]
  },
  Checkbox: {
    title: 'Checkbox 复选框组件',
    description: '一个复选框组件，用于多选场景。',
    features: [
      '✅ **三态支持** - 选中、未选中、半选',
      '🎨 **Material Design** - 遵循 MD3 设计规范',
      '⌨️ **键盘支持** - 空格键切换',
      '♿ **无障碍** - 完整的 ARIA 支持',
      '📦 **组合组件** - 由 Input + Icon 组成'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '基础复选框',
        code: `<Checkbox v-model="checked" label="同意条款" />`
      }
    ]
  },
  Chip: {
    title: 'Chip 标签组件',
    description: '一个标签组件，用于显示标签、过滤器或可删除的项目。',
    features: [
      '🎨 **多种样式** - 支持 filled、outlined 样式',
      '🌈 **丰富颜色** - 多种语义化颜色',
      '❌ **可删除** - 支持删除操作',
      '🔧 **图标支持** - 可添加图标',
      '📦 **组合组件** - 由 Button + Icon 组成'
    ],
    dependencies: ['Button', 'Icon'],
    useCases: [
      {
        title: '标签列表',
        code: `<Chip
  v-for="tag in tags"
  :key="tag"
  closable
  @close="removeTag(tag)"
>
  {{ tag }}
</Chip>`
      }
    ]
  },
  ConfirmableDialog: {
    title: 'ConfirmableDialog 可确认对话框组件',
    description: '一个带确认逻辑的对话框组件，用于需要用户确认的操作。',
    features: [
      '✅ **确认逻辑** - 内置确认/取消逻辑',
      '⚠️ **脏数据检测** - 检测未保存的更改',
      '🔒 **防误操作** - 二次确认机制',
      '📦 **组合组件** - 基于 Dialog 组件'
    ],
    dependencies: ['Dialog'],
    useCases: [
      {
        title: '表单确认',
        code: `<ConfirmableDialog
  :show="showDialog"
  :is-dirty="hasChanges"
  title="编辑信息"
  @confirm="handleSave"
>
  <form>...</form>
</ConfirmableDialog>`
      }
    ]
  },
  Tabs: {
    title: 'Tabs 标签页组件',
    description: '一个标签页组件，用于组织和切换不同的内容区域。',
    features: [
      '🎨 **Material Design** - 遵循 MD3 设计规范',
      '⌨️ **键盘导航** - 方向键切换标签',
      '🔧 **图标支持** - 标签可包含图标',
      '♿ **无障碍** - 完整的 ARIA 支持',
      '📦 **组合组件** - 可能包含 Icon'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '基础标签页',
        code: `<Tabs v-model="activeTab">
  <Tab value="tab1" label="标签1">内容1</Tab>
  <Tab value="tab2" label="标签2">内容2</Tab>
</Tabs>`
      }
    ]
  },
  Avatar: {
    title: 'Avatar 头像组件',
    description: '一个头像组件，用于显示用户头像或占位符。',
    features: [
      '🖼️ **图片支持** - 显示用户头像',
      '🔤 **文字头像** - 显示用户名首字母',
      '📏 **多种尺寸** - sm、md、lg 等',
      '🎨 **颜色定制** - 支持自定义背景色',
      '📦 **组合组件** - 可能包含 Icon'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '用户头像',
        code: `<Avatar src="/avatar.jpg" alt="用户名" />`
      }
    ]
  },
  Notification: {
    title: 'Notification 通知组件',
    description: '一个通知组件，用于显示全局通知消息。',
    features: [
      '🎨 **多种类型** - success、info、warning、error',
      '⏱️ **自动关闭** - 支持自动关闭',
      '❌ **手动关闭** - 支持手动关闭',
      '📍 **位置定制** - 支持多个位置',
      '📦 **组合组件** - 由 Icon + 内容组成'
    ],
    dependencies: ['Icon'],
    useCases: [
      {
        title: '成功通知',
        code: `notification.success({
  message: '操作成功',
  duration: 3000
})`
      }
    ]
  },
  ThemeToggle: {
    title: 'ThemeToggle 主题切换组件',
    description: '一个主题切换组件，用于切换亮色/暗色主题。',
    features: [
      '🌓 **主题切换** - 亮色/暗色主题切换',
      '💾 **状态持久化** - 记住用户选择',
      '🎨 **平滑过渡** - 主题切换动画',
      '📦 **组合组件** - 由 Icon + Button 组成'
    ],
    dependencies: ['Icon', 'Button'],
    useCases: [
      {
        title: '主题切换按钮',
        code: `<ThemeToggle />`
      }
    ]
  },
  UrlInput: {
    title: 'UrlInput URL 输入框组件',
    description: '一个 URL 输入框组件，带 URL 验证和格式化功能。',
    features: [
      '✅ **URL 验证** - 自动验证 URL 格式',
      '🔧 **自动格式化** - 自动添加协议',
      '🎨 **错误提示** - 清晰的错误提示',
      '📦 **组合组件** - 基于 Input 组件'
    ],
    dependencies: ['Input'],
    useCases: [
      {
        title: 'URL 输入',
        code: `<UrlInput
  v-model="url"
  placeholder="https://example.com"
  @validate="handleValidate"
/>`
      }
    ]
  },
  AppHeader: {
    title: 'AppHeader 应用头部组件',
    description: '一个应用头部组件，包含导航、搜索、用户信息等。',
    features: [
      '🎨 **响应式布局** - 适配不同屏幕',
      '🔍 **搜索集成** - 可包含搜索功能',
      '👤 **用户信息** - 显示用户头像和菜单',
      '📦 **组合组件** - 由 Icon + Button + ThemeToggle 组成'
    ],
    dependencies: ['Icon', 'Button', 'ThemeToggle'],
    useCases: [
      {
        title: '应用头部',
        code: `<AppHeader
  title="应用名称"
  :user="currentUser"
  @menu-click="handleMenu"
/>`
      }
    ]
  },
  SyncProgressDialog: {
    title: 'SyncProgressDialog 同步进度对话框组件',
    description: '一个同步进度对话框组件，用于显示同步任务的进度。',
    features: [
      '📊 **进度显示** - 实时显示同步进度',
      '⏱️ **时间估算** - 显示剩余时间',
      '📝 **阶段提示** - 显示当前同步阶段',
      '📦 **组合组件** - 由 Dialog + Icon + Button 组成'
    ],
    dependencies: ['Dialog', 'Icon', 'Button'],
    useCases: [
      {
        title: '同步进度',
        code: `<SyncProgressDialog
  :show="syncing"
  :progress="syncProgress"
  @cancel="cancelSync"
/>`
      }
    ]
  },
  PerformanceMonitor: {
    title: 'PerformanceMonitor 性能监控组件',
    description: '一个性能监控组件，用于显示应用性能指标。',
    features: [
      '📊 **性能指标** - FPS、内存使用等',
      '📈 **实时监控** - 实时更新数据',
      '🎨 **可视化** - 图表展示',
      '📦 **组合组件** - 由 Button + Icon 组成'
    ],
    dependencies: ['Button', 'Icon'],
    useCases: [
      {
        title: '性能监控',
        code: `<PerformanceMonitor :enabled="isDev" />`
      }
    ]
  }
}

/**
 * 生成复合组件 README 模板
 */
function generateReadmeTemplate(componentName) {
  const info = COMPONENT_INFO[componentName] || {
    title: `${componentName} 组件`,
    description: `一个 ${componentName} 复合组件。`,
    features: [
      '🎨 **样式定制** - 支持自定义样式',
      '📏 **灵活配置** - 丰富的配置选项',
      '🎯 **无障碍** - 符合 WCAG 标准',
      '📦 **组合组件** - 由多个基础组件组成'
    ],
    dependencies: [],
    useCases: []
  }

  const dependenciesSection = info.dependencies.length > 0
    ? `## 🔗 依赖组件

本组件依赖以下基础组件：

${info.dependencies.map(dep => `- [${dep}](../../base/${dep}/README.md)`).join('\n')}
`
    : ''

  const useCasesSection = info.useCases.length > 0
    ? `## 💡 使用场景

${info.useCases.map(useCase => `### ${useCase.title}

\`\`\`vue
<template>
  ${useCase.code}
</template>
\`\`\`
`).join('\n')}
`
    : `## 💡 使用场景

待补充
`

  return `# ${info.title}

${info.description}

## ✨ 特性

${info.features.map(f => `- ${f}`).join('\n')}

## 📦 安装

\`\`\`typescript
import { ${componentName} } from '@/components'
\`\`\`

${dependenciesSection}

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

${useCasesSection}

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

## ⚠️ 注意事项

1. 这是复合组件，由多个基础组件组合而成
2. 不包含业务逻辑，保持通用性
3. 可在任何项目中使用

## 🔗 相关组件

- [组件分类规范](../../README.md)
- [基础组件文档](../../base/README.md)
- [复合组件文档](../README.md)

## 📝 更新日志

- **v1.0.0** - 初始版本

---

**组件类型**: 复合组件  
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
  return content.includes('TODO') || content.includes('待补充') || content.length < 500
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始生成复合组件 README...\n')
  
  const components = fs.readdirSync(COMPOSITE_COMPONENTS_DIR)
    .filter(name => {
      const componentPath = path.join(COMPOSITE_COMPONENTS_DIR, name)
      return fs.statSync(componentPath).isDirectory()
    })
  
  let generated = 0
  let skipped = 0
  
  for (const componentName of components) {
    const componentPath = path.join(COMPOSITE_COMPONENTS_DIR, componentName)
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
