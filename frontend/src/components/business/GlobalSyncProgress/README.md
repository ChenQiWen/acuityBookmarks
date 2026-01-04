# GlobalSyncProgress

## 📖 组件描述

全局同步进度对话框组件，显示书签同步的实时进度，支持错误处理和重试。

## ✨ 特性

- ✅ 全局单例 - 所有页面共享同一个进度状态
- ✅ 自动订阅 - 自动订阅 BookmarkSyncService 的进度更新
- ✅ 实时进度 - 显示同步阶段、百分比、当前/总数
- ✅ 错误处理 - 支持错误提示和重试
- ✅ 强制关闭 - 支持强制关闭（带警告确认）
- ✅ 预计时间 - 显示预计剩余时间

## 🔗 依赖组件

- [SyncProgressDialog](../../composite/SyncProgressDialog/README.md) - 同步进度对话框

## 📦 安装

```vue
<script setup lang="ts">
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
</script>
```

## 🎯 基础用法

### 在页面根组件中添加

```vue
<script setup lang="ts">
import GlobalSyncProgress from '@/components/business/GlobalSyncProgress/GlobalSyncProgress.vue'
</script>

<template>
  <div class="app">
    <!-- 页面内容 -->
    <router-view />
    
    <!-- 全局同步进度 -->
    <GlobalSyncProgress />
  </div>
</template>
```

### 触发同步

```typescript
// 从任何地方触发同步
import { bookmarkSyncService } from '@/application/bookmark/bookmark-sync-service'

// 开始同步
await bookmarkSyncService.startSync()

// 进度会自动显示在 GlobalSyncProgress 中
```

## 📋 API 文档

### Props

此组件不接受任何 props。

### Emits

此组件不触发任何事件。

### Slots

此组件不提供任何插槽。

## 🎨 使用场景

### 场景 1：初始化同步

```typescript
// 应用启动时自动同步
import { bookmarkSyncService } from '@/application/bookmark/bookmark-sync-service'

onMounted(async () => {
  await bookmarkSyncService.startSync()
  // GlobalSyncProgress 会自动显示进度
})
```

### 场景 2：手动触发同步

```vue
<script setup lang="ts">
import { bookmarkSyncService } from '@/application/bookmark/bookmark-sync-service'

async function handleSync() {
  await bookmarkSyncService.startSync()
  // GlobalSyncProgress 会自动显示进度
}
</script>

<template>
  <Button @click="handleSync">同步书签</Button>
</template>
```

### 场景 3：监听同步状态

```typescript
import { bookmarkSyncService } from '@/application/bookmark/bookmark-sync-service'

// 订阅同步进度
bookmarkSyncService.subscribe((progress) => {
  console.log('同步进度:', progress)
  // GlobalSyncProgress 会自动更新 UI
})
```

## 🔧 工作原理

### 同步流程

```
1. 用户触发同步
   ↓
2. BookmarkSyncService 开始同步
   ↓
3. GlobalSyncProgress 自动显示进度对话框
   ↓
4. 实时更新进度（阶段、百分比、当前/总数）
   ↓
5. 同步完成或失败
   ↓
6. 显示结果（成功/失败）
   ↓
7. 用户关闭对话框
```

### 进度状态

```typescript
interface SyncProgress {
  stage: 'idle' | 'syncing' | 'completed' | 'failed'
  phase: string           // 当前阶段描述
  percentage: number      // 百分比 (0-100)
  current: number         // 当前处理数量
  total: number           // 总数量
  estimatedTime: number   // 预计剩余时间（秒）
  error?: string          // 错误信息
}
```

## ⚠️ 注意事项

### 1. 必须在每个页面添加

```vue
<!-- ✅ 正确：在每个页面的根组件中添加 -->
<template>
  <div>
    <router-view />
    <GlobalSyncProgress />
  </div>
</template>

<!-- ❌ 错误：只在某些页面添加 -->
<template>
  <div>
    <router-view />
    <!-- 缺少 GlobalSyncProgress -->
  </div>
</template>
```

### 2. 全局单例

```typescript
// ✅ 正确：所有页面共享同一个进度状态
// 在 Popup 页面触发同步
await bookmarkSyncService.startSync()

// 在 Management 页面也能看到进度
// GlobalSyncProgress 会自动显示

// ❌ 错误：不要创建多个实例
<GlobalSyncProgress />
<GlobalSyncProgress />  // 重复了
```

### 3. 强制关闭警告

```typescript
// ✅ 正确：强制关闭前警告用户
function handleForceClose() {
  const confirmed = window.confirm(
    '⚠️ 警告：同步尚未完成，强制关闭可能导致数据不完整。'
  )
  if (confirmed) {
    forceClose()
  }
}

// ❌ 错误：直接关闭，不警告
function handleForceClose() {
  forceClose()  // 可能导致数据不完整
}
```

### 4. 不要手动清理订阅

```typescript
// ✅ 正确：不清理订阅（全局单例）
onUnmounted(() => {
  // 不清理订阅，因为可能有其他页面还在使用
})

// ❌ 错误：清理订阅（会影响其他页面）
onUnmounted(() => {
  cleanup()  // 其他页面将无法看到进度
})
```

## 🎯 进度显示

### 同步阶段

| 阶段 | 描述 | 百分比 |
|------|------|--------|
| **idle** | 空闲状态 | 0% |
| **syncing** | 同步中 | 1-99% |
| **completed** | 同步完成 | 100% |
| **failed** | 同步失败 | - |

### 进度信息

```typescript
// 示例进度数据
{
  stage: 'syncing',
  phase: '正在同步书签...',
  percentage: 45,
  current: 9000,
  total: 20000,
  estimatedTime: 120  // 预计还需 2 分钟
}
```

## 🔗 相关组件

- [SyncProgressDialog](../../composite/SyncProgressDialog/README.md) - 同步进度对话框
- [GlobalQuickAddBookmark](../GlobalQuickAddBookmark/README.md) - 全局快速添加书签

## 📚 相关文档

- [业务组件规范](../README.md)
- [组件分类规范](../../README.md)
- [BookmarkSyncService](../../../application/bookmark/bookmark-sync-service.ts)
- [useGlobalSyncProgress](../../../composables/useGlobalSyncProgress.ts)

## 🔄 更新日志

### v1.0.0 (2025-01-05)

- ✅ 初始版本
- ✅ 支持全局单例
- ✅ 支持实时进度更新
- ✅ 支持错误处理和重试
- ✅ 支持强制关闭（带警告）
- ✅ 支持预计剩余时间

---

**最后更新**: 2025-01-05  
**维护者**: Kiro AI
