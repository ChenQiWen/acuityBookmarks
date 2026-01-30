# useTraitData Composables 使用示例

## 概述

`useTraitData` 提供了一组响应式的 Composable API，用于访问书签特征数据。

**核心优势：**
- ✅ 响应式：数据自动更新，无需手动刷新
- ✅ 类型安全：完整的 TypeScript 类型支持
- ✅ 简单易用：一行代码即可获取数据
- ✅ 自动初始化：首次使用时自动初始化

---

## 基础使用

### 1. 获取特征统计

```vue
<script setup lang="ts">
import { useTraitStatistics } from '@/composables/useTraitData'

// ✅ 获取所有特征统计（响应式）
const statistics = useTraitStatistics()
</script>

<template>
  <div class="trait-stats">
    <div class="stat-item">
      <span>重复书签:</span>
      <span>{{ statistics.duplicate }}</span>
    </div>
    <div class="stat-item">
      <span>失效书签:</span>
      <span>{{ statistics.invalid }}</span>
    </div>
    <div class="stat-item">
      <span>内部书签:</span>
      <span>{{ statistics.internal }}</span>
    </div>
  </div>
</template>
```

### 2. 获取单个特征数量

```vue
<script setup lang="ts">
import { useTraitCount } from '@/composables/useTraitData'

// ✅ 只获取失效书签数量
const invalidCount = useTraitCount('invalid')
const duplicateCount = useTraitCount('duplicate')
</script>

<template>
  <div>
    <p v-if="invalidCount > 0" class="alert">
      发现 {{ invalidCount }} 个失效书签
    </p>
    <p v-if="duplicateCount > 0" class="warning">
      发现 {{ duplicateCount }} 个重复书签
    </p>
  </div>
</template>
```

### 3. 检查是否有问题

```vue
<script setup lang="ts">
import { useHasNegativeTraits, useTotalNegativeTraits } from '@/composables/useTraitData'

const hasProblems = useHasNegativeTraits()
const totalProblems = useTotalNegativeTraits()
</script>

<template>
  <div v-if="hasProblems" class="alert-banner">
    <span>⚠️ 发现 {{ totalProblems }} 个需要关注的问题</span>
    <button @click="handleFix">立即处理</button>
  </div>
</template>
```

---

## 高级使用

### 4. 显示加载状态

```vue
<script setup lang="ts">
import { useTraitStatistics, useTraitLoading } from '@/composables/useTraitData'

const statistics = useTraitStatistics()
const isLoading = useTraitLoading()
</script>

<template>
  <div>
    <div v-if="isLoading" class="loading">
      加载中...
    </div>
    <div v-else class="stats">
      <p>重复: {{ statistics.duplicate }}</p>
      <p>失效: {{ statistics.invalid }}</p>
    </div>
  </div>
</template>
```

### 5. 手动刷新数据

```vue
<script setup lang="ts">
import { useTraitStatistics, useRefreshTraits } from '@/composables/useTraitData'

const statistics = useTraitStatistics()
const refreshTraits = useRefreshTraits()

async function handleRefresh() {
  try {
    await refreshTraits()
    console.log('刷新成功')
  } catch (error) {
    console.error('刷新失败', error)
  }
}
</script>

<template>
  <div>
    <button @click="handleRefresh">刷新统计</button>
    <div>重复: {{ statistics.duplicate }}</div>
  </div>
</template>
```

### 6. 显示最后更新时间

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useTraitLastUpdated } from '@/composables/useTraitData'

const lastUpdated = useTraitLastUpdated()

const formattedTime = computed(() => {
  if (lastUpdated.value === 0) return '未更新'
  return new Date(lastUpdated.value).toLocaleString('zh-CN')
})
</script>

<template>
  <div class="update-info">
    最后更新: {{ formattedTime }}
  </div>
</template>
```

---

## 完整示例：特征概览组件

```vue
<script setup lang="ts">
import { computed } from 'vue'
import {
  useTraitStatistics,
  useHasNegativeTraits,
  useTotalNegativeTraits,
  useTraitLoading,
  useRefreshTraits
} from '@/composables/useTraitData'

// 获取数据
const statistics = useTraitStatistics()
const hasProblems = useHasNegativeTraits()
const totalProblems = useTotalNegativeTraits()
const isLoading = useTraitLoading()
const refreshTraits = useRefreshTraits()

// 计算属性
const statusColor = computed(() => {
  if (totalProblems.value === 0) return 'green'
  if (totalProblems.value < 10) return 'yellow'
  return 'red'
})

// 方法
async function handleRefresh() {
  await refreshTraits()
}

function handleViewDetails(trait: string) {
  console.log('查看详情:', trait)
}
</script>

<template>
  <div class="trait-overview">
    <div class="header">
      <h3>书签健康状态</h3>
      <button @click="handleRefresh" :disabled="isLoading">
        {{ isLoading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div v-if="hasProblems" class="alert" :class="`alert-${statusColor}`">
      ⚠️ 发现 {{ totalProblems }} 个需要关注的问题
    </div>

    <div class="stats-grid">
      <div class="stat-card" @click="handleViewDetails('duplicate')">
        <div class="stat-icon">🔄</div>
        <div class="stat-label">重复书签</div>
        <div class="stat-value">{{ statistics.duplicate }}</div>
      </div>

      <div class="stat-card" @click="handleViewDetails('invalid')">
        <div class="stat-icon">❌</div>
        <div class="stat-label">失效书签</div>
        <div class="stat-value">{{ statistics.invalid }}</div>
      </div>

      <div class="stat-card" @click="handleViewDetails('internal')">
        <div class="stat-icon">🔒</div>
        <div class="stat-label">内部书签</div>
        <div class="stat-value">{{ statistics.internal }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trait-overview {
  padding: var(--spacing-4);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
}

.alert {
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-4);
}

.alert-green {
  background-color: #d1fae5;
  color: #065f46;
}

.alert-yellow {
  background-color: #fef3c7;
  color: #92400e;
}

.alert-red {
  background-color: #fee2e2;
  color: #991b1b;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-3);
}

.stat-card {
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.stat-card:hover {
  background-color: var(--color-surface-hover);
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 24px;
  margin-bottom: var(--spacing-2);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-1);
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
}
</style>
```

---

## API 参考

### useTraitStatistics()

返回所有特征的统计数据（响应式）。

**返回值：** `ComputedRef<TraitStatistics>`

```typescript
interface TraitStatistics {
  duplicate: number  // 重复书签数量
  invalid: number    // 失效书签数量
  internal: number   // 内部书签数量
}
```

### useTraitCount(trait)

返回指定特征的数量（响应式）。

**参数：**
- `trait: TraitTag` - 特征类型 (`'duplicate' | 'invalid' | 'internal'`)

**返回值：** `ComputedRef<number>`

### useTotalNegativeTraits()

返回负面特征的总数（响应式）。

**返回值：** `ComputedRef<number>`

### useHasNegativeTraits()

返回是否有负面特征（响应式）。

**返回值：** `ComputedRef<boolean>`

### useTraitLoading()

返回是否正在加载（响应式）。

**返回值：** `ComputedRef<boolean>`

### useTraitLastUpdated()

返回最后更新时间戳（响应式）。

**返回值：** `ComputedRef<number>`

### useRefreshTraits()

返回手动刷新函数。

**返回值：** `() => Promise<void>`

---

## 注意事项

1. **自动初始化**：首次使用任何 composable 时会自动初始化 Store
2. **自动更新**：当特征数据变化时，所有使用这些 composable 的组件会自动更新
3. **缓存策略**：数据会缓存 5 分钟，避免频繁查询
4. **类型安全**：所有 API 都有完整的 TypeScript 类型支持

---

## 迁移指南

### 从旧的方式迁移

**❌ 旧的方式（不推荐）：**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTraitFilterStore } from '@/stores'

const store = useTraitFilterStore()
const invalidCount = ref(0)

onMounted(async () => {
  await store.refreshStatistics()
  invalidCount.value = store.state.statistics.invalid
})

// ❌ 需要手动监听消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'acuity-bookmarks-trait-updated') {
    store.refreshStatistics()
  }
})
</script>
```

**✅ 新的方式（推荐）：**

```vue
<script setup lang="ts">
import { useTraitCount } from '@/composables/useTraitData'

// ✅ 一行代码，自动更新
const invalidCount = useTraitCount('invalid')
</script>
```

---

## 常见问题

### Q: 数据什么时候会更新？

A: 当以下情况发生时，数据会自动更新：
- 特征检测完成
- 书签同步完成
- 手动调用 `refreshTraits()`

### Q: 如何强制刷新数据？

A: 使用 `useRefreshTraits()` composable：

```typescript
const refreshTraits = useRefreshTraits()
await refreshTraits()
```

### Q: 数据会缓存吗？

A: 是的，数据会缓存 5 分钟。如果需要强制刷新，使用 `refreshTraits()`。

### Q: 可以在多个组件中使用吗？

A: 可以！所有组件共享同一个数据源，数据更新时所有组件都会自动更新。
