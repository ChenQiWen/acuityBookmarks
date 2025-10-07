# AcuityBookmarks UI Components

轻量级、高性能的UI组件库，专为AcuityBookmarks设计。

## 🎯 设计原则

- **性能优先**: 专为大量数据场景优化
- **类型安全**: 完整的TypeScript支持
- **一致性**: 统一的设计语言和API
- **可访问性**: 遵循WCAG 2.1标准
- **简洁性**: 零冗余，高内聚低耦合

## 🎨 设计系统

### 颜色

```css
/* 主色调 */
--color-primary: #1976d2 --color-primary-hover: #1565c0
  --color-primary-active: #0d47a1 /* 语义色 */ --color-success: #4caf50
  --color-warning: #ff9800 --color-error: #f44336 --color-info: #2196f3
  /* 中性色 */ --color-text-primary: #212121 --color-text-secondary: #757575
  --color-border: #e0e0e0 --color-surface: #ffffff;
```

### 间距

```css
/* 8px base unit */
--space-1: 4px --space-2: 8px --space-3: 12px --space-4: 16px --space-6: 24px
  --space-8: 32px;
```

### 字体

```css
--font-size-xs: 12px --font-size-sm: 14px --font-size-base: 16px
  --font-size-lg: 18px --font-size-xl: 20px;
```

## 📚 组件使用

### Button 按钮

```vue
<template>
  <!-- 基础用法 -->
  <AcuityButton>默认按钮</AcuityButton>

  <!-- 变体 -->
  <AcuityButton variant="primary">主要按钮</AcuityButton>
  <AcuityButton variant="secondary">次要按钮</AcuityButton>
  <AcuityButton variant="outline">边框按钮</AcuityButton>
  <AcuityButton variant="ghost">幽灵按钮</AcuityButton>
  <AcuityButton variant="text">文本按钮</AcuityButton>

  <!-- 尺寸 -->
  <AcuityButton size="sm">小按钮</AcuityButton>
  <AcuityButton size="md">中按钮</AcuityButton>
  <AcuityButton size="lg">大按钮</AcuityButton>

  <!-- 图标 -->
  <AcuityButton icon-left="plus">添加</AcuityButton>
  <AcuityButton icon-right="arrow-right">下一步</AcuityButton>

  <!-- 状态 -->
  <AcuityButton :loading="true">加载中</AcuityButton>
  <AcuityButton :disabled="true">禁用</AcuityButton>

  <!-- 块级 -->
  <AcuityButton block>块级按钮</AcuityButton>
</template>
```

#### Button Props

| 属性      | 类型                                                       | 默认值    | 说明     |
| --------- | ---------------------------------------------------------- | --------- | -------- |
| variant   | 'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'text' | 'primary' | 按钮变体 |
| size      | 'sm' \| 'md' \| 'lg'                                       | 'md'      | 按钮尺寸 |
| iconLeft  | string                                                     | -         | 左侧图标 |
| iconRight | string                                                     | -         | 右侧图标 |
| loading   | boolean                                                    | false     | 加载状态 |
| disabled  | boolean                                                    | false     | 禁用状态 |
| block     | boolean                                                    | false     | 块级按钮 |

### Icon 图标

```vue
<template>
  <!-- 基础用法 -->
  <AcuityIcon name="home" />

  <!-- 尺寸 -->
  <AcuityIcon name="star" size="xs" />
  <AcuityIcon name="star" size="sm" />
  <AcuityIcon name="star" size="md" />
  <AcuityIcon name="star" size="lg" />
  <AcuityIcon name="star" size="xl" />
  <AcuityIcon name="star" :size="24" />

  <!-- 颜色 -->
  <AcuityIcon name="heart" color="red" />
  <AcuityIcon name="heart" color="--color-primary" />

  <!-- 动画 -->
  <AcuityIcon name="loading" spin />

  <!-- 变换 -->
  <AcuityIcon name="arrow-up" :rotate="90" />
  <AcuityIcon name="arrow-left" flip-h />
  <AcuityIcon name="arrow-up" flip-v />
</template>
```

### Card 卡片

```vue
<template>
  <!-- 基础用法 -->
  <AcuityCard title="卡片标题"> 卡片内容 </AcuityCard>

  <!-- 带图标和副标题 -->
  <AcuityCard
    title="书签统计"
    subtitle="最近更新：2024年1月"
    icon="chart-line"
    icon-color="--color-primary"
  >
    <p>总计 1,234 个书签</p>
  </AcuityCard>

  <!-- 带操作按钮 -->
  <AcuityCard title="操作卡片">
    <template #actions>
      <AcuityButton size="sm" variant="ghost" icon-left="edit"
        >编辑</AcuityButton
      >
      <AcuityButton size="sm" variant="ghost" icon-left="delete"
        >删除</AcuityButton
      >
    </template>

    卡片内容

    <template #footer>
      <AcuityButton variant="primary">保存</AcuityButton>
    </template>
  </AcuityCard>

  <!-- 可点击卡片 -->
  <AcuityCard title="可点击卡片" clickable hover @click="handleCardClick">
    点击我
  </AcuityCard>
</template>
```

## 🚀 虚拟化组件

### VirtualBookmarkTree 虚拟化书签树

```vue
<template>
  <VirtualBookmarkTree
    :bookmarks="bookmarks"
    :expanded-ids="expandedIds"
    :selected-ids="selectedIds"
    :height="600"
    :item-height="32"
    search-query="搜索关键词"
    cleanup-mode
    @toggle="handleToggle"
    @select="handleSelect"
    @batch-operation="handleBatchOperation"
  />
</template>

<script setup>
import { ref } from 'vue'
import { VirtualBookmarkTree } from '@/components/virtual'

// 数据
const bookmarks = ref([])
const expandedIds = ref(new Set())
const selectedIds = ref(new Set())

// 事件处理
const handleToggle = id => {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  // 触发响应式更新
  expandedIds.value = new Set(expandedIds.value)
}

const handleSelect = (id, event) => {
  if (event.ctrlKey || event.metaKey) {
    // 多选
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
  } else {
    // 单选
    selectedIds.value.clear()
    selectedIds.value.add(id)
  }
  selectedIds.value = new Set(selectedIds.value)
}

const handleBatchOperation = (type, data) => {
  console.log('批量操作:', type, data)
}
</script>
```

## 🎛️ 高级用法

### 主题定制

```css
/* 自定义主题变量 */
:root {
  --color-primary: #your-color;
  --border-radius: 8px;
  --space-unit: 4px;
}

/* 深色主题 */
[data-theme='dark'] {
  --color-background: #1a1a1a;
  --color-surface: #2d2d2d;
  --color-text-primary: #ffffff;
}
```

### 性能优化

```vue
<template>
  <!-- 使用 v-memo 优化大列表渲染 -->
  <div v-for="item in items" :key="item.id" v-memo="[item.id, item.title]">
    <VirtualTreeItem :item="item" />
  </div>

  <!-- 使用 v-once 优化静态内容 -->
  <AcuityIcon v-once name="static-icon" />
</template>

<script>
// 使用 shallowRef 优化大对象
import { shallowRef } from 'vue'

const largeDataSet = shallowRef([])
</script>
```

### 无障碍访问

```vue
<template>
  <!-- 正确的 ARIA 标签 -->
  <AcuityButton aria-label="删除书签" aria-describedby="delete-tooltip">
    <AcuityIcon name="delete" />
  </AcuityButton>

  <!-- 键盘导航支持 -->
  <div role="tree" aria-label="书签树" @keydown="handleKeydown">
    <VirtualBookmarkTree />
  </div>
</template>
```

## 📝 开发规范

### 组件命名

- 使用 `Acuity` 前缀
- 采用 PascalCase
- 描述性命名

### Props 设计

- 使用 TypeScript 类型定义
- 提供合理的默认值
- 使用 validator 验证

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})
```

### 事件命名

- 使用 kebab-case
- 遵循 HTML 标准事件命名
- 提供清晰的事件数据

```typescript
const emit = defineEmits<{
  click: [event: Event]
  'custom-event': [data: any]
}>()
```

## 🔧 工具函数

### 样式工具

```typescript
// 生成组件类名
const generateClasses = (base: string, modifiers: Record<string, boolean>) => {
  return [
    base,
    ...Object.entries(modifiers)
      .filter(([_, value]) => value)
      .map(([key]) => `${base}--${key}`)
  ]
}

// 使用示例
const buttonClasses = generateClasses('btn', {
  primary: props.variant === 'primary',
  loading: props.loading,
  disabled: props.disabled
})
```

### 性能监控

```typescript
// 组件性能监控
const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now()
  fn()
  const end = performance.now()
  console.log(`${name}: ${end - start}ms`)
}
```

## 📊 性能基准

| 操作           | 目标性能 | 当前性能 |
| -------------- | -------- | -------- |
| 渲染1000个按钮 | <50ms    | ✅ 30ms  |
| 虚拟化10000项  | <100ms   | ✅ 60ms  |
| 主题切换       | <16ms    | ✅ 10ms  |
| 组件卸载       | <16ms    | ✅ 8ms   |

## 📄 更新日志

### v1.0.0 (2024-01-15)

- ✨ 初始版本发布
- 🎨 完整的设计系统
- 🚀 虚拟化树组件
- ♿ 无障碍访问支持
- 📱 响应式设计
