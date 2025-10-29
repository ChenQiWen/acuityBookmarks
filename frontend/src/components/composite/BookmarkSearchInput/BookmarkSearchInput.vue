<!--
BookmarkSearchInput - 书签搜索输入组件

职责：
- 提供搜索输入框
- 调用核心书签检索服务
- 返回标准书签树结构数据
- 不负责展示结果（由父组件决定）

数据流：
用户输入 → 搜索服务 → emit('search-complete', results)

注意：
- 数据源默认 IndexedDB，可外部传入
- 只负责搜索逻辑，不负责结果展示
- 保持单一职责原则
-->

<template>
  <div class="bookmark-search-input">
    <!-- 搜索输入框 -->
    <div class="search-input-wrapper">
      <Icon name="icon-magnify" :size="20" color="text-secondary" />
      <Input
        v-model="query"
        class="search-input"
        placeholder="搜索书签..."
        :disabled="disabled"
        clearable
        @clear="handleClear"
      />
      <Spinner v-if="isSearching" size="sm" class="search-spinner" />
    </div>

    <!-- 搜索状态提示 -->
    <div v-if="showStats && totalResults > 0" class="search-stats">
      <span class="stats-text">找到 {{ totalResults }} 个结果</span>
      <span v-if="executionTime" class="stats-time">
        ({{ executionTime }}ms)
      </span>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="search-error">
      <Icon name="icon-alert-circle" :size="16" color="error" />
      <span class="error-text">{{ error.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue'
import { Icon, Input, Spinner } from '@/components'
import { useBookmarkSearch } from '@/composables/useBookmarkSearch'
import type { BookmarkNode } from '@/types'
import { useDebounceFn } from '@vueuse/core'

defineOptions({
  name: 'BookmarkSearchInput'
})

interface Props {
  /**
   * 搜索模式
   * - indexeddb: 从 IndexedDB 搜索（默认）
   * - memory: 从内存数据搜索
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 内存数据源（mode='memory' 时使用）
   */
  data?: BookmarkNode[]

  /**
   * 搜索结果数量限制
   * @default 100
   */
  limit?: number

  /**
   * 防抖延迟（毫秒）
   * @default 300
   */
  debounce?: number

  /**
   * 是否禁用
   */
  disabled?: boolean

  /**
   * 是否显示统计信息
   */
  showStats?: boolean

  /**
   * 初始搜索关键词
   */
  initialQuery?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'indexeddb',
  limit: 100,
  debounce: 300,
  disabled: false,
  showStats: true,
  initialQuery: ''
})

interface Emits {
  /**
   * 搜索完成事件
   * @param results - 搜索结果（标准书签树结构）
   */
  'search-complete': [results: BookmarkNode[]]

  /**
   * 搜索开始事件
   * @param query - 搜索关键词
   */
  'search-start': [query: string]

  /**
   * 搜索错误事件
   * @param error - 错误对象
   */
  'search-error': [error: Error]

  /**
   * 搜索清空事件
   */
  'search-clear': []
}

const emit = defineEmits<Emits>()

// 使用书签搜索 Composable
const {
  query,
  bookmarkNodes,
  isFiltering: isSearching,
  error,
  totalResults,
  executionTime,
  filter,
  clear
} = useBookmarkSearch({
  mode: props.mode,
  data: computed(() => props.data ?? []),
  limit: props.limit,
  initialQuery: props.initialQuery,
  autoFilter: false // 手动控制搜索时机
})

// 防抖搜索
const debouncedSearch = useDebounceFn(async (searchQuery: string) => {
  if (!searchQuery.trim()) {
    clear()
    emit('search-clear')
    return
  }

  try {
    emit('search-start', searchQuery)
    await filter(searchQuery)
    emit('search-complete', bookmarkNodes.value)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    emit('search-error', error)
  }
}, props.debounce)

// 监听搜索关键词变化
watch(query, newQuery => {
  debouncedSearch(newQuery)
})

// 清空搜索
const handleClear = () => {
  clear()
  emit('search-clear')
}

/**
 * 手动触发搜索
 * @param searchQuery - 搜索关键词
 */
const search = async (searchQuery: string) => {
  query.value = searchQuery
  await filter(searchQuery)
  emit('search-complete', bookmarkNodes.value)
}

/**
 * 获取当前搜索结果
 */
const getResults = () => bookmarkNodes.value

/**
 * 清空搜索
 */
const clearSearch = () => {
  clear()
  emit('search-clear')
}

defineExpose({
  search,
  getResults,
  clear: clearSearch,
  isSearching,
  totalResults
})
</script>

<style scoped>
.bookmark-search-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  transition: border-color var(--transition-fast);
}

.search-input-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
}

.search-input :deep(.input-wrapper) {
  border: none !important;
  padding: 0 !important;
  background: transparent !important;
}

.search-input :deep(.input-wrapper:focus-within) {
  box-shadow: none !important;
}

.search-spinner {
  flex-shrink: 0;
}

.search-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  padding: 0 var(--spacing-1);
}

.stats-time {
  color: var(--color-text-tertiary);
}

.search-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-error-subtle);
  border-radius: var(--border-radius-sm);
  font-size: var(--text-sm);
}

.error-text {
  color: var(--color-error-emphasis);
}
</style>
