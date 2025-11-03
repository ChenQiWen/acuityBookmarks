# Presentation 层适配器使用示例

## 📚 快速开始

### 1. 在组件中使用适配器

**之前（违规）**：

```vue
<script setup lang="ts">
// ❌ 直接访问基础设施层
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

// ❌ 直接访问应用层（虽然好一些，但仍应该通过适配器）
import { notificationService } from '@/application/notification/notification-service'

const loadBookmarks = async () => {
  try {
    const bookmarks = await indexedDBManager.getAllBookmarks()
    // ...
  } catch (error) {
    logger.error('...', error)
    notificationService.showError('加载失败')
  }
}
</script>
```

**现在（正确）**：

```vue
<script setup lang="ts">
// ✅ 通过 Presentation 层适配器
import { bookmarkPresentationAdapter } from '@/presentation/adapters/bookmark-adapter'
import { useNotification } from '@/presentation/composables/useNotification'

const notify = useNotification()

const loadBookmarks = async () => {
  const result = await bookmarkPresentationAdapter.getBookmarks()
  if (result.error) {
    // 错误已经在适配器中统一处理了
    return
  }
  // 使用 result.data
}
</script>
```

### 2. 使用 Composables（推荐）

```vue
<script setup lang="ts">
// ✅ 使用 Composables，更简洁
import { useBookmarkData } from '@/presentation/composables/useBookmarkData'
import { useNotification } from '@/presentation/composables/useNotification'

const { bookmarks, loading, error, loadBookmarks } = useBookmarkData()
const notify = useNotification()

// 加载书签
onMounted(() => {
  loadBookmarks()
})

// 在模板中使用
</script>

<template>
  <div v-if="loading">加载中...</div>
  <div v-else-if="error">错误: {{ error.message }}</div>
  <div v-else>{{ bookmarks.length }} 个书签</div>
</template>
```

## 🎯 适配器的作用

### 1. 隔离层间依赖

```
❌ 之前：Component → Infrastructure (违规)
✅ 现在：Component → Presentation → Application → Infrastructure
```

### 2. 统一错误处理

适配器内部统一处理错误：

- 记录日志
- 显示用户友好的错误提示
- 返回标准化的错误结果

### 3. 提供 UI 友好的接口

```typescript
// ❌ 应用层接口（复杂）
const result = await bookmarkAppService.getAllBookmarks()
if (result.ok) {
  // 使用 result.value
} else {
  // 处理 result.error
}

// ✅ 适配器接口（简单）
const result = await bookmarkPresentationAdapter.getBookmarks()
// 错误已经在适配器中处理了，直接使用 result.data
if (result.data) {
  // 使用数据
}
```

## 📋 已创建的适配器

1. **BookmarkPresentationAdapter** (`presentation/adapters/bookmark-adapter.ts`)
   - `getBookmarks()` - 获取所有书签
   - `getBookmarkById(id)` - 根据 ID 获取书签
   - `searchBookmarks(query)` - 搜索书签
   - `getChildrenByParentId(parentId)` - 获取子节点

2. **NotificationPresentationAdapter** (`presentation/adapters/notification-adapter.ts`)
   - `showSuccess(message)` - 显示成功消息
   - `showError(message)` - 显示错误消息
   - `showWarning(message)` - 显示警告消息
   - `showInfo(message)` - 显示信息消息
   - `showSystemNotification(title, message, level)` - 显示系统通知
   - `showLoading(message)` - 显示加载提示

## 🎨 Composables

1. **useBookmarkData()** (`presentation/composables/useBookmarkData.ts`)
   - 响应式的书签数据管理
   - 自动处理加载状态和错误

2. **useNotification()** (`presentation/composables/useNotification.ts`)
   - 统一的通知接口
   - 简化通知调用

## 🔄 迁移指南

### 步骤 1：替换导入

```typescript
// ❌ 删除
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { logger } from '@/infrastructure/logging/logger'

// ✅ 添加
import { bookmarkPresentationAdapter } from '@/presentation'
import { useNotification } from '@/presentation'
```

### 步骤 2：替换调用

```typescript
// ❌ 之前
const bookmarks = await indexedDBManager.getAllBookmarks()

// ✅ 现在
const result = await bookmarkPresentationAdapter.getBookmarks()
const bookmarks = result.data || []
```

### 步骤 3：移除错误处理（已在适配器中处理）

```typescript
// ❌ 之前
try {
  const bookmarks = await indexedDBManager.getAllBookmarks()
} catch (error) {
  logger.error('...', error)
  notificationService.showError('加载失败')
}

// ✅ 现在（错误已在适配器中处理）
const result = await bookmarkPresentationAdapter.getBookmarks()
if (result.error) {
  // 错误已记录日志并显示通知，这里只需要处理业务逻辑
  return
}
```

## 💡 最佳实践

1. **优先使用 Composables**
   - 更简洁、更符合 Vue 3 风格
   - 自动处理响应式状态

2. **适配器用于复杂场景**
   - 需要多个服务协调时
   - 需要自定义错误处理时

3. **逐步迁移**
   - 新组件直接使用适配器
   - 旧组件逐步迁移，保持向后兼容

## 📖 更多示例

查看 `presentation/README.md` 了解详细说明和架构设计。
