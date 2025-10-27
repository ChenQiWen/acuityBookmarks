# 爬取功能使用指南

## 📚 概述

所有页面现在都应该使用 `useCrawler` Composable 来与后台爬取系统交互，而不是直接使用旧的调度器。

## 🎯 快速开始

### 基础用法

```vue
<script setup lang="ts">
import { useCrawler } from '@/composables/useCrawler'

const { isRunning, progress, startCrawl } = useCrawler()

async function handleCrawl() {
  await startCrawl()
}
</script>

<template>
  <Button @click="handleCrawl" :disabled="isRunning">
    {{ isRunning ? '爬取中...' : '开始爬取' }}
  </Button>

  <ProgressBar v-if="isRunning" :value="progress" />
</template>
```

## 📋 完整示例

### Management 页面示例

```vue
<script setup lang="ts">
import { useCrawler } from '@/composables/useCrawler'
import { ref, computed } from 'vue'
import { Button, ProgressBar, Card } from '@/components'

// ==================== 爬取功能 ====================

const {
  isRunning,
  isPaused,
  progress,
  completed,
  failed,
  total,
  error,
  startCrawl,
  pause,
  resume,
  cancel,
  togglePause
} = useCrawler({
  // 自动加载当前进度
  autoLoadProgress: true,

  // 进度回调
  onProgress: stats => {
    console.log('爬取进度:', stats)
  },

  // 完成回调
  onComplete: stats => {
    console.log('爬取完成！', stats)
    showSuccessToast(`✅ 完成！共 ${stats.completed} 个`)
  },

  // 错误回调
  onError: err => {
    showErrorToast(`❌ 错误: ${err.message}`)
  }
})

// 选中的书签
const selectedBookmarkIds = ref<string[]>([])

// 计算属性
const statusText = computed(() => {
  if (isRunning.value) {
    return isPaused.value ? '已暂停' : '爬取中'
  }
  return '空闲'
})

const progressText = computed(() => {
  if (total.value === 0) return '等待开始'
  return `${completed.value}/${total.value} (${progress.value.toFixed(1)}%)`
})

// ==================== 操作方法 ====================

/** 爬取选中的书签 */
async function crawlSelected() {
  if (selectedBookmarkIds.value.length === 0) {
    showWarningToast('请先选择书签')
    return
  }

  await startCrawl({
    bookmarkIds: selectedBookmarkIds.value,
    priority: 'high'
  })
}

/** 爬取所有未处理的书签 */
async function crawlAll() {
  await startCrawl({
    // 不传 bookmarkIds，后台会自动爬取所有未处理的
    priority: 'normal'
  })
}

/** 爬取指定优先级 */
async function crawlWithPriority(
  priority: 'low' | 'normal' | 'high' | 'urgent'
) {
  await startCrawl({
    bookmarkIds: selectedBookmarkIds.value,
    priority
  })
}
</script>

<template>
  <div class="crawler-panel">
    <!-- 状态卡片 -->
    <Card>
      <h3>爬取状态</h3>
      <div class="status-info">
        <div>状态: {{ statusText }}</div>
        <div>进度: {{ progressText }}</div>
        <div v-if="failed > 0" class="failed-count">失败: {{ failed }} 个</div>
      </div>

      <!-- 进度条 -->
      <ProgressBar
        v-if="isRunning"
        :value="progress"
        :max="100"
        color="primary"
        :animated="!isPaused"
      />

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">⚠️ {{ error }}</div>
    </Card>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <!-- 开始爬取 -->
      <Button
        @click="crawlSelected"
        :disabled="isRunning || selectedBookmarkIds.length === 0"
        color="primary"
      >
        爬取选中 ({{ selectedBookmarkIds.length }})
      </Button>

      <Button @click="crawlAll" :disabled="isRunning" color="secondary">
        爬取全部未处理
      </Button>

      <!-- 暂停/恢复 -->
      <Button v-if="isRunning" @click="togglePause" color="warning">
        {{ isPaused ? '▶️ 恢复' : '⏸️ 暂停' }}
      </Button>

      <!-- 取消 -->
      <Button v-if="isRunning" @click="cancel" color="error"> ⏹️ 取消 </Button>
    </div>
  </div>
</template>

<style scoped>
.crawler-panel {
  padding: var(--spacing-md);
}

.status-info {
  margin: var(--spacing-sm) 0;
}

.failed-count {
  color: var(--color-error);
}

.error-message {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-error-alpha-10);
  border-radius: var(--radius-sm);
  color: var(--color-error);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}
</style>
```

### Popup 页面示例

```vue
<script setup lang="ts">
import { useCrawler } from '@/composables/useCrawler'
import { Button, ProgressBar } from '@/components'

// 仅显示状态，不提供操作按钮
const { isRunning, progress, completed, total } = useCrawler({
  autoLoadProgress: true // 自动加载当前进度
})
</script>

<template>
  <Card v-if="isRunning" class="crawl-status">
    <div class="crawl-info">
      <Icon name="icon-download" />
      <span>正在爬取书签...</span>
    </div>
    <ProgressBar :value="progress" :max="100" />
    <div class="crawl-progress">{{ completed }} / {{ total }}</div>
  </Card>
</template>
```

### Settings 页面示例

```vue
<script setup lang="ts">
import { useCrawler } from '@/composables/useCrawler'
import { Button } from '@/components'

const { isRunning, progress, startCrawl, cancel } = useCrawler({
  onComplete: stats => {
    console.log('后台爬取完成', stats)
  }
})

// 立即爬取所有未处理的书签
async function crawlAllNow() {
  await startCrawl({
    priority: 'urgent'
  })
}
</script>

<template>
  <Card title="爬取设置">
    <p>后台会自动每小时爬取一次未处理的书签</p>

    <Button @click="crawlAllNow" :disabled="isRunning"> 立即爬取 </Button>

    <div v-if="isRunning">
      <ProgressBar :value="progress" />
      <Button @click="cancel" variant="text"> 取消 </Button>
    </div>
  </Card>
</template>
```

## 🔧 API 参考

### useCrawler(options?)

#### Options

```typescript
interface UseCrawlerOptions {
  /** 是否在组件挂载时自动获取当前进度 */
  autoLoadProgress?: boolean

  /** 进度更新回调 */
  onProgress?: (stats: QueueStatistics) => void

  /** 完成回调 */
  onComplete?: (stats: QueueStatistics) => void

  /** 错误回调 */
  onError?: (error: { message: string }) => void
}
```

#### 返回值

```typescript
{
  // ===== 状态 =====

  /** 统计信息 */
  stats: Ref<QueueStatistics>

  /** 是否正在爬取 */
  isRunning: ComputedRef<boolean>

  /** 是否已暂停 */
  isPaused: ComputedRef<boolean>

  /** 进度百分比 (0-100) */
  progress: ComputedRef<number>

  /** 已完成数量 */
  completed: ComputedRef<number>

  /** 失败数量 */
  failed: ComputedRef<number>

  /** 总数 */
  total: ComputedRef<number>

  /** 错误信息 */
  error: Ref<string | null>

  // ===== 方法 =====

  /** 启动爬取 */
  startCrawl(params?: {
    bookmarkIds?: string[]
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    respectRobots?: boolean
  }): Promise<boolean>

  /** 暂停爬取 */
  pause(): Promise<boolean>

  /** 恢复爬取 */
  resume(): Promise<boolean>

  /** 取消爬取 */
  cancel(): Promise<boolean>

  /** 切换暂停/恢复 */
  togglePause(): Promise<boolean>

  /** 刷新当前进度 */
  refreshProgress(): Promise<void>
}
```

## 💡 最佳实践

### 1. 组件中使用

```typescript
// ✅ 推荐：使用 Composable
const { isRunning, progress, startCrawl } = useCrawler()

// ❌ 不推荐：直接使用客户端
import { createCrawlerClient } from '@/services/background-crawler-client'
const client = createCrawlerClient() // 需要手动管理生命周期
```

### 2. 自动加载进度

```typescript
// 页面打开时显示当前爬取状态
const crawler = useCrawler({
  autoLoadProgress: true // 自动获取
})
```

### 3. 错误处理

```typescript
const { error, startCrawl } = useCrawler({
  onError: err => {
    // 统一错误处理
    showToast(err.message, 'error')
  }
})

// 或者检查 error ref
watchEffect(() => {
  if (error.value) {
    console.error('爬取错误:', error.value)
  }
})
```

### 4. 显示详细进度

```typescript
const { stats } = useCrawler()

// stats 包含所有信息
watchEffect(() => {
  console.log({
    total: stats.value.total,
    completed: stats.value.completed,
    failed: stats.value.failed,
    pending: stats.value.pending,
    running: stats.value.running,
    paused: stats.value.paused,
    progress: stats.value.progress // 0-100
  })
})
```

## 🚫 迁移指南

### 旧代码 (不要使用)

```typescript
// ❌ 旧方式
import { crawlTaskScheduler } from '@/services/crawl-task-scheduler'
import { crawlMultipleBookmarks } from '@/services/local-bookmark-crawler'

// 直接调用
await crawlTaskScheduler.scheduleBookmarksCrawl(bookmarks, {
  onProgress: stats => {
    /* ... */
  }
})

// 或
await crawlMultipleBookmarks(bookmarks)
```

### 新代码 (推荐使用)

```typescript
// ✅ 新方式
import { useCrawler } from '@/composables/useCrawler'

const { startCrawl } = useCrawler({
  onProgress: stats => {
    /* ... */
  }
})

// 通过消息与后台通信
await startCrawl({ bookmarkIds: ids })
```

## 🎨 UI 组件示例

### 爬取按钮组件

```vue
<script setup lang="ts">
import { useCrawler } from '@/composables/useCrawler'

const { isRunning, startCrawl } = useCrawler()

defineProps<{
  bookmarkIds: string[]
}>()
</script>

<template>
  <Button
    @click="startCrawl({ bookmarkIds })"
    :loading="isRunning"
    :disabled="bookmarkIds.length === 0"
  >
    <template #prepend>
      <Icon name="icon-download" />
    </template>
    爬取元数据
  </Button>
</template>
```

### 爬取进度卡片

```vue
<script setup lang="ts">
import { useCrawler } from '@/composables/useCrawler'

const { isRunning, progress, completed, total, cancel } = useCrawler({
  autoLoadProgress: true
})
</script>

<template>
  <Card v-if="isRunning">
    <template #title>
      <Icon name="icon-loading" spin />
      爬取进行中
    </template>

    <ProgressBar :value="progress" animated />

    <div class="progress-text">{{ completed }} / {{ total }}</div>

    <Button @click="cancel" variant="text" size="sm"> 取消 </Button>
  </Card>
</template>
```

## 📊 常见场景

### 场景 1：爬取选中的书签

```typescript
const { startCrawl } = useCrawler()

async function crawlSelected(ids: string[]) {
  await startCrawl({
    bookmarkIds: ids,
    priority: 'high'
  })
}
```

### 场景 2：爬取全部未处理

```typescript
const { startCrawl } = useCrawler()

async function crawlAll() {
  // 不传 bookmarkIds，后台自动处理未处理的书签
  await startCrawl()
}
```

### 场景 3：低优先级后台爬取

```typescript
const { startCrawl } = useCrawler()

async function crawlInBackground() {
  await startCrawl({
    priority: 'low', // 低优先级，不影响用户操作
    respectRobots: true
  })
}
```

### 场景 4：监控爬取状态

```typescript
const { isRunning, progress, completed, total } = useCrawler({
  autoLoadProgress: true
})

// 在模板中使用
// <div v-if="isRunning">{{ completed }} / {{ total }}</div>
```

---

**最后更新**：2025-10-27  
**相关文件**：

- Composable: `frontend/src/composables/useCrawler.ts`
- 客户端: `frontend/src/services/background-crawler-client.ts`
- 后台管理器: `frontend/src/background/crawler-manager.ts`
