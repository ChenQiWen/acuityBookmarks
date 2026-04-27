# LucideIcon 快速开始

## 5 分钟上手

### 1. 导入组件

```vue
<script setup lang="ts">
import { LucideIcon } from '@/components/base/LucideIcon'
</script>
```

### 2. 使用图标

```vue
<template>
  <!-- 基础用法 -->
  <LucideIcon name="bookmark" />
  
  <!-- 指定尺寸和颜色 -->
  <LucideIcon name="star" size="lg" color="primary" />
  
  <!-- 加载动画 -->
  <LucideIcon name="loader" spin />
</template>
```

### 3. 常用场景

#### 按钮图标

```vue
<button>
  <LucideIcon name="plus" size="sm" />
  <span>添加书签</span>
</button>
```

#### 状态指示

```vue
<div class="status">
  <LucideIcon name="check-circle" color="success" />
  <span>同步成功</span>
</div>
```

#### 加载状态

```vue
<LucideIcon v-if="loading" name="loader" spin />
<LucideIcon v-else name="check" color="success" />
```

## 常用图标速查

| 用途 | 图标名称 |
|------|---------|
| 添加 | `plus` |
| 删除 | `trash` |
| 编辑 | `edit` |
| 保存 | `save` |
| 搜索 | `search` |
| 设置 | `settings` |
| 书签 | `bookmark` |
| 收藏 | `star` |
| 文件夹 | `folder` |
| 成功 | `check-circle` |
| 错误 | `x-circle` |
| 警告 | `alert-triangle` |
| 信息 | `info` |
| 加载 | `loader` |
| 刷新 | `refresh` |

## 从 Material Icons 迁移

```vue
<!-- 旧的 Material Icon -->
<Icon name="icon-bookmark-Add" />

<!-- 新的 Lucide Icon -->
<LucideIcon name="bookmark-plus" />
```

使用映射表快速查找:

```typescript
import { materialToLucideMap } from '@/components/base/LucideIcon'

const newName = materialToLucideMap['icon-bookmark-Add'] // 'bookmark-plus'
```

## 完整文档

查看 [README.md](./README.md) 了解更多详细信息。
