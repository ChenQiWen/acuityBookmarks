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
    <!-- 可展开搜索框 -->
    <div
      class="search-wrapper"
      :class="{ expanded: isExpanded, searching: isSearching }"
    >
      <!-- 输入框容器 -->
      <div class="input-container">
        <Input
          ref="inputRef"
          v-model="query"
          class="search-input"
          placeholder="搜索书签..."
          :disabled="disabled"
          borderless
          @blur="handleBlur"
          @keydown.esc="handleEscape"
        />
      </div>

      <!-- 搜索图标按钮 -->
      <button
        class="search-icon-button"
        :class="{ 'has-query': query.length > 0 }"
        @mousedown="isClickingButton = true"
        @click="handleIconClick"
      >
        <Spinner v-if="isSearching" size="sm" />
        <Icon
          v-else-if="query.length > 0"
          name="icon-close"
          :size="20"
          color="text-secondary"
        />
        <Icon v-else name="icon-search" :size="20" color="text-secondary" />
      </button>
    </div>

    <!-- 搜索状态提示 -->
    <Transition name="stats-fade">
      <div
        v-if="showStats && totalResults > 0 && isExpanded"
        class="search-stats"
      >
        <span class="stats-text">找到 {{ totalResults }} 个结果</span>
        <span v-if="executionTime" class="stats-time">
          ({{ executionTime }}ms)
        </span>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <Transition name="error-fade">
      <div v-if="error && isExpanded" class="search-error">
        <Icon name="icon-error" :size="16" color="error" />
        <span class="error-text">{{ error.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { watch, computed, ref, nextTick, onUnmounted } from 'vue'
import { Icon, Input, Spinner } from '@/components'
import { useBookmarkSearch } from '@/composables/useBookmarkSearch'
import type { BookmarkNode } from '@/types'
import { useDebounceFn } from '@vueuse/core'

defineOptions({
  name: 'BookmarkSearchInput'
})

// 展开状态
const isExpanded = ref(false)
const inputRef = ref<InstanceType<typeof Input>>()

// 防止点击按钮时触发失焦收起的标记
const isClickingButton = ref(false)
let blurTimeoutId: ReturnType<typeof setTimeout> | null = null

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

// 处理图标点击
const handleIconClick = async () => {
  // 标记正在点击按钮，防止失焦事件触发收起
  isClickingButton.value = true

  // 取消任何待执行的失焦收起
  if (blurTimeoutId) {
    clearTimeout(blurTimeoutId)
    blurTimeoutId = null
  }

  if (query.value) {
    // 如果有内容，点击清空
    handleClear()
  } else if (isExpanded.value) {
    // 如果已展开且无内容，收起
    isExpanded.value = false
  } else {
    // 展开并聚焦
    isExpanded.value = true
    await nextTick()
    inputRef.value?.$el?.querySelector('input')?.focus()
  }

  // 短暂延迟后重置标记
  setTimeout(() => {
    isClickingButton.value = false
  }, 100)
}

// 处理失焦
const handleBlur = () => {
  // 如果正在点击按钮，不要收起
  if (isClickingButton.value) {
    return
  }

  // 如果没有内容，延迟收起
  if (!query.value) {
    // 清除之前的定时器
    if (blurTimeoutId) {
      clearTimeout(blurTimeoutId)
    }

    blurTimeoutId = setTimeout(() => {
      // 再次检查，确保不是在点击按钮
      if (!query.value && !isClickingButton.value) {
        isExpanded.value = false
      }
      blurTimeoutId = null
    }, 200)
  }
}

// 处理 ESC 键
const handleEscape = () => {
  if (query.value) {
    handleClear()
  } else {
    isExpanded.value = false
  }
}

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

// 清理定时器
onUnmounted(() => {
  if (blurTimeoutId) {
    clearTimeout(blurTimeoutId)
    blurTimeoutId = null
  }
})
</script>

<style scoped>
.bookmark-search-input {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: flex-end;
}

/* 搜索框包裹器 */
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 32px; /* 初始圆形宽度 */
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px; /* 完全圆形 */
  overflow: hidden;
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* 展开状态 */
.search-wrapper.expanded {
  width: 280px; /* 展开后的宽度 */
  border-radius: 20px; /* 保持圆角 */
}

/* 搜索中状态 */
.search-wrapper.searching {
  border-color: var(--color-primary);
}

/* 聚焦状态 */
.search-wrapper:has(.search-input:focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

/* 悬停效果 */
.search-wrapper:hover {
  border-color: var(--color-primary-hover);
}

/* 输入框容器 */
.input-container {
  flex: 1;
  opacity: 0;
  width: 0;
  overflow: hidden;
  transition:
    opacity 0.2s ease 0.1s,
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-wrapper.expanded .input-container {
  opacity: 1;
  width: 100%;
}

/* 输入框样式 */
.search-input {
  width: 100%;
}

.search-input :deep(.acuity-input-container) {
  padding: 0 var(--spacing-3);
  min-height: 30px;
}

.search-input :deep(.acuity-input) {
  font-size: var(--text-sm);
}

/* 搜索图标按钮 */
.search-icon-button {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.2s ease;
  outline: none;
}

.search-icon-button:hover {
  background: var(--color-bg-hover);
}

.search-icon-button:active {
  background: var(--color-bg-active);
  opacity: 0.8;
}

.search-icon-button.has-query {
  color: var(--color-primary);
}

/* 统计信息 */
.search-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  padding: 0 var(--spacing-2);
  white-space: nowrap;
}

.stats-time {
  color: var(--color-text-tertiary);
}

/* 错误提示 */
.search-error {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--color-error-subtle);
  border-radius: var(--border-radius-md);
  font-size: var(--text-xs);
  max-width: 280px;
}

.error-text {
  color: var(--color-error-emphasis);
  flex: 1;
}

/* 过渡动画 */
.stats-fade-enter-active,
.stats-fade-leave-active,
.error-fade-enter-active,
.error-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.stats-fade-enter-from,
.stats-fade-leave-to,
.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
